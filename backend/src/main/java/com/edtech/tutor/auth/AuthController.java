package com.edtech.tutor.auth;

import com.edtech.tutor.auth.AuthDtos.LoginRequest;
import com.edtech.tutor.auth.AuthDtos.LoginResponse;
import com.edtech.tutor.auth.AuthDtos.StudentResponse;
import com.edtech.tutor.shared.web.ApiException;
import com.edtech.tutor.shared.web.ErrorCode;
import com.edtech.tutor.student.StudentRepository;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final StudentRepository students;

    AuthController(AuthenticationManager authenticationManager, JwtService jwtService, StudentRepository students) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.students = students;
    }

    @PostMapping("/login")
    LoginResponse login(@Valid @RequestBody LoginRequest request) {
        var authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(request.email().strip(), request.password()));
        var principal = (StudentPrincipal) authentication.getPrincipal();
        var token = jwtService.issueFor(principal);
        return new LoginResponse(token.value(), "Bearer", token.expiresAt(), StudentResponse.from(principal));
    }

    /** Perfil del alumno del token. Permite al frontend validar una sesión guardada al recargar. */
    @GetMapping("/me")
    StudentResponse me(@CurrentStudentId UUID studentId) {
        return students.findById(studentId)
                .map(StudentResponse::from)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED));
    }
}
