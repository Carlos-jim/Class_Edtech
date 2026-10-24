package com.edtech.tutor;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

/** Emite tokens válidos para tests sin pasar por el login (el login ya se prueba en AuthSecurityTests). */
public final class TestTokens {

    private TestTokens() {
    }

    public static String bearer(JwtEncoder encoder, UUID studentId) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder()
                .issuer("lms-tutor")
                .subject(studentId.toString())
                .issuedAt(now)
                .expiresAt(now.plus(Duration.ofMinutes(10)))
                .build();
        var token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims));
        return "Bearer " + token.getTokenValue();
    }
}
