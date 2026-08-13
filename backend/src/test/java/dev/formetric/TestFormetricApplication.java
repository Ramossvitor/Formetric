package dev.formetric;

import org.springframework.boot.SpringApplication;

public class TestFormetricApplication {

	public static void main(String[] args) {
		SpringApplication.from(FormetricApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
