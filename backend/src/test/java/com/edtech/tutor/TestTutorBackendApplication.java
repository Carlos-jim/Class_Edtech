package com.edtech.tutor;

import org.springframework.boot.SpringApplication;

public class TestTutorBackendApplication {

	public static void main(String[] args) {
		SpringApplication.from(TutorBackendApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
