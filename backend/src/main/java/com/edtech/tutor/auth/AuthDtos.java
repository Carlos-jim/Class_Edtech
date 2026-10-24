package com.edtech.tutor.auth;

import com.edtech.tutor.student.Student;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** Contratos HTTP del módulo de autenticación. Las entidades JPA nunca se serializan directamente. */
final class AuthDtos {

    private AuthDtos() {
    }

    record LoginRequest(
            @NotBlank(message = "El correo es obligatorio")
            @Email(message = "El correo no tiene un formato válido")
            @Size(max = 255)
            String email,

            @NotBlank(message = "La contraseña es obligatoria")
            @Size(max = 128)
            String password) {
    }

    record StudentResponse(UUID id, String email, String displayName) {

        static StudentResponse from(Student student) {
            return new StudentResponse(student.getId(), student.getEmail(), student.getDisplayName());
        }

        static StudentResponse from(StudentPrincipal principal) {
            return new StudentResponse(principal.id(), principal.email(), principal.displayName());
        }
    }

    record LoginResponse(String accessToken, String tokenType, Instant expiresAt, StudentResponse student) {
    }
}
