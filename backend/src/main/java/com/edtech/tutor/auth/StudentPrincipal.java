package com.edtech.tutor.auth;

import com.edtech.tutor.student.Student;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/** Alumno autenticado durante el login (usuario + contraseña). Tras el login, la identidad viaja en el JWT. */
record StudentPrincipal(UUID id, String email, String displayName, String passwordHash) implements UserDetails {

    static StudentPrincipal from(Student student) {
        return new StudentPrincipal(student.getId(), student.getEmail(), student.getDisplayName(), student.getPasswordHash());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_STUDENT"));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }
}
