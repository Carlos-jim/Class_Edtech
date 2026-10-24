package com.edtech.tutor.auth;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

/**
 * Inyecta el id ({@link java.util.UUID}) del alumno autenticado, extraído del {@code sub} del JWT.
 * Los controladores NUNCA reciben el id del alumno desde la URL o el cuerpo (prevención de IDOR).
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@AuthenticationPrincipal(expression = "T(java.util.UUID).fromString(subject)", errorOnInvalidType = true)
public @interface CurrentStudentId {
}
