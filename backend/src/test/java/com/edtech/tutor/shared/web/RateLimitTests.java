package com.edtech.tutor.shared.web;

import static com.edtech.tutor.SeedData.ANA;
import static com.edtech.tutor.SeedData.BRUNO;
import static com.edtech.tutor.SeedData.LESSON_2;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.edtech.tutor.IntegrationTest;
import com.edtech.tutor.TestTokens;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@IntegrationTest
@TestPropertySource(properties = {
        "app.rate-limit.login.requests=3",
        "app.rate-limit.questions.requests=2",
})
class RateLimitTests {

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder jwtEncoder;
    @Autowired JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM conversation");
    }

    @Test
    void loginIsThrottledPerIpAgainstBruteForce() throws Exception {
        for (int i = 0; i < 3; i++) {
            login("10.0.0.1").andExpect(status().isUnauthorized());
        }

        login("10.0.0.1")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(HttpHeaders.RETRY_AFTER, org.hamcrest.Matchers.matchesPattern("\\d+")))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(greaterThanOrEqualTo(1)));

        login("10.0.0.2").andExpect(status().isUnauthorized());
    }

    @Test
    void questionsAreThrottledPerStudentToProtectTheAiQuota() throws Exception {
        ask(ANA).andExpect(status().isCreated());
        ask(ANA).andExpect(status().isCreated());

        ask(ANA).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        // Otro alumno tiene su propio cupo (Bruno no tiene acceso: 404, pero no 429)
        ask(BRUNO).andExpect(status().isNotFound());
    }

    @Test
    void readsAreNotThrottled() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(get("/api/courses").header(HttpHeaders.AUTHORIZATION, TestTokens.bearer(jwtEncoder, ANA)))
                    .andExpect(status().isOk());
        }
    }

    private ResultActions login(String ip) throws Exception {
        return mvc.perform(post("/api/auth/login")
                .with(request -> {
                    request.setRemoteAddr(ip);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"ana.garcia@demo.edtech","password":"mala"}"""));
    }

    private ResultActions ask(UUID studentId) throws Exception {
        return mvc.perform(post("/api/lessons/{id}/messages", LESSON_2)
                .header(HttpHeaders.AUTHORIZATION, TestTokens.bearer(jwtEncoder, studentId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"content":"¿Qué es GET?","inputMode":"TEXT"}"""));
    }
}
