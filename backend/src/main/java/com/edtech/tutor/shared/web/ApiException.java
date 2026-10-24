package com.edtech.tutor.shared.web;

/** Error de negocio que se traduce a una respuesta ProblemDetail con su {@link ErrorCode}. */
public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code) {
        this(code, code.defaultDetail());
    }

    public ApiException(ErrorCode code, String detail) {
        super(detail);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }
}
