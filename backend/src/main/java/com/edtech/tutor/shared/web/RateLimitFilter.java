package com.edtech.tutor.shared.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.regex.Pattern;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Aplica {@link RateLimitProperties}. Va después de la autenticación para poder limitar por alumno; el login se
 * limita por IP (detrás de nginx, la IP real llega por X-Forwarded-For: ver server.forward-headers-strategy).
 * Responde 429 con {@code Retry-After} y el mismo formato ProblemDetail que el resto de errores.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Pattern ASK_PATH = Pattern.compile("^/api/lessons/[^/]+/messages/?$");

    private final SlidingWindowRateLimiter login;
    private final SlidingWindowRateLimiter questions;
    private final SlidingWindowRateLimiter transcriptions;

    public RateLimitFilter(RateLimitProperties properties, Clock clock) {
        this.login = limiter(properties.login(), clock);
        this.questions = limiter(properties.questions(), clock);
        this.transcriptions = limiter(properties.transcriptions(), clock);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!"POST".equals(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        var path = request.getRequestURI().substring(request.getContextPath().length());
        SlidingWindowRateLimiter.Decision decision = null;
        if (path.equals("/api/auth/login")) {
            decision = login.tryAcquire("ip:" + request.getRemoteAddr());
        } else if (ASK_PATH.matcher(path).matches()) {
            decision = questions.tryAcquire("student:" + currentUser(request));
        } else if (path.equals("/api/transcriptions")) {
            decision = transcriptions.tryAcquire("student:" + currentUser(request));
        }

        if (decision != null && !decision.allowed()) {
            reject(response, decision.retryAfterSeconds());
            return;
        }
        chain.doFilter(request, response);
    }

    /** Liberar memoria de claves inactivas (llamado periódicamente). */
    public void evictIdle() {
        login.evictIdle();
        questions.evictIdle();
        transcriptions.evictIdle();
    }

    private static String currentUser(HttpServletRequest request) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                ? authentication.getName()
                : "anon:" + request.getRemoteAddr();
    }

    private static void reject(HttpServletResponse response, long retryAfterSeconds) throws IOException {
        var code = ErrorCode.RATE_LIMITED;
        response.setStatus(code.status().value());
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("""
                {"type":"about:blank","title":"Too Many Requests","status":429,"detail":"%s","code":"%s","retryAfterSeconds":%d}"""
                .formatted(code.defaultDetail(), code.name(), retryAfterSeconds));
    }

    private static SlidingWindowRateLimiter limiter(RateLimitProperties.Rule rule, Clock clock) {
        return new SlidingWindowRateLimiter(rule.requests(), rule.window(), clock);
    }
}
