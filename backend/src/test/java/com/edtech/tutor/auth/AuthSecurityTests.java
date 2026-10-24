package com.edtech.tutor.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.edtech.tutor.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AuthSecurityTests {

    static final String ANA_ID = "a1b2c3d4-0000-4000-8000-000000000001";
    static final String ISSUER = "lms-tutor";

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder jwtEncoder;

    // --- Login -------------------------------------------------------------------------------

    @Test
    void loginWithValidCredentialsReturnsBearerTokenAndProfile() throws Exception {
        mvc.perform(login("ANA.GARCIA@demo.edtech", "Demo1234!"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.expiresAt").isString())
                .andExpect(jsonPath("$.student.id").value(ANA_ID))
                .andExpect(jsonPath("$.student.displayName").value("Ana García"))
                .andExpect(jsonPath("$.student.passwordHash").doesNotExist());
    }

    @Test
    void wrongPasswordAndUnknownEmailGetTheSameGenericError() throws Exception {
        for (var request : new String[][] {{"ana.garcia@demo.edtech", "incorrecta"}, {"nadie@demo.edtech", "Demo1234!"}}) {
            mvc.perform(login(request[0], request[1]))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                    .andExpect(jsonPath("$.detail").value("Correo o contraseña incorrectos"));
        }
    }

    @Test
    void invalidLoginBodyReturnsFieldErrors() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"no-es-un-correo","password":""}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fields.email").exists())
                .andExpect(jsonPath("$.fields.password").exists());
    }

    @Test
    void malformedJsonReturnsBadRequestWithoutInternals() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{roto"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    // --- Token -------------------------------------------------------------------------------

    @Test
    void meReturnsTheStudentFromTheToken() throws Exception {
        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(loginAndGetToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ANA_ID))
                .andExpect(jsonPath("$.email").value("ana.garcia@demo.edtech"));
    }

    @Test
    void protectedEndpointWithoutTokenReturns401Problem() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, startsWith("Bearer")))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void tamperedTokenIsRejected() throws Exception {
        var token = loginAndGetToken();
        var tampered = token.substring(0, token.length() - 4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");

        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(tampered)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        var past = Instant.now().minus(Duration.ofHours(3));
        var token = mint(jwtEncoder, ISSUER, past, past.plus(Duration.ofHours(1)));

        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() throws Exception {
        var otherKey = new SecretKeySpec(
                "otro-secreto-de-atacante-0123456789-abcdefgh".getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        var foreignEncoder = new NimbusJwtEncoder(new ImmutableSecret<>(otherKey));
        var token = mint(foreignEncoder, ISSUER, Instant.now(), Instant.now().plus(Duration.ofHours(1)));

        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenFromAnotherIssuerIsRejected() throws Exception {
        var token = mint(jwtEncoder, "otro-emisor", Instant.now(), Instant.now().plus(Duration.ofHours(1)));

        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    // --- CORS, cabeceras y endpoints públicos -------------------------------------------------

    @Test
    void corsPreflightAllowsOnlyConfiguredOrigin() throws Exception {
        mvc.perform(options("/api/auth/login")
                        .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200"));

        mvc.perform(options("/api/auth/login")
                        .header(HttpHeaders.ORIGIN, "https://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void responsesIncludeSecurityHeaders() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy", containsString("frame-ancestors 'none'")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"));
    }

    @Test
    void jwtPropertiesRejectShortSecret() {
        assertThatThrownBy(() -> new JwtProperties("corto", Duration.ofHours(1), ISSUER))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    // --- helpers -----------------------------------------------------------------------------

    private static org.springframework.test.web.servlet.RequestBuilder login(String email, String password) {
        return post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"%s","password":"%s"}""".formatted(email, password));
    }

    private String loginAndGetToken() throws Exception {
        var body = mvc.perform(login("ana.garcia@demo.edtech", "Demo1234!"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.accessToken");
    }

    private static String mint(JwtEncoder encoder, String issuer, Instant issuedAt, Instant expiresAt) {
        var claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(ANA_ID)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
