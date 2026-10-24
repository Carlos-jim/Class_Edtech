package com.edtech.tutor.auth;

import com.edtech.tutor.student.StudentRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
class StudentUserDetailsService implements UserDetailsService {

    private final StudentRepository students;

    StudentUserDetailsService(StudentRepository students) {
        this.students = students;
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        return students.findByEmailIgnoreCase(email.strip())
                .map(StudentPrincipal::from)
                .orElseThrow(() -> new UsernameNotFoundException("Alumno no encontrado"));
    }
}
