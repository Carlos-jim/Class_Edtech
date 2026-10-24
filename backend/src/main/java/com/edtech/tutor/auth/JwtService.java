package com.edtech.tutor.auth;

import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Emite tokens de acceso firmados con HS256. El {@code sub} es el id del alumno: la única fuente de identidad. */
@Service
class JwtService {

    record IssuedToken(String value, Instant expiresAt) {
    }

    private final JwtEncoder encoder;
    private final JwtProperties properties;

    JwtService(JwtEncoder encoder, JwtProperties properties) {
        this.encoder = encoder;
        this.properties = properties;
    }

    IssuedToken issueFor(StudentPrincipal student) {
        var now = Instant.now();
        var expiresAt = now.plus(properties.ttl());
        var claims = JwtClaimsSet.builder()
                .issuer(properties.issuer())
                .subject(student.id().toString())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("name", student.displayName())
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        var token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }
}
