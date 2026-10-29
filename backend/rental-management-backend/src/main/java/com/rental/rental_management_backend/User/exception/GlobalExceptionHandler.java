
package com.rental.rental_management_backend.User.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.rental.rental_management_backend.ai.exception.M4PaymentRiskException;


@RestControllerAdvice
public class GlobalExceptionHandler {

        @ExceptionHandler(ResourceNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleResourceNotFound(ResourceNotFoundException ex) {

                return buildResponse(
                                HttpStatus.NOT_FOUND,
                                ex.getMessage());
        }

        @ExceptionHandler(AccessDeniedException.class)
        public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {

                return buildResponse(
                                HttpStatus.FORBIDDEN,
                                "Access denied: you do not have permission to perform this action");
        }

        @ExceptionHandler(UserAlreadyExistsException.class)
        public ResponseEntity<Map<String, Object>> handleUserAlreadyExists(UserAlreadyExistsException ex) {

                return buildResponse(
                                HttpStatus.CONFLICT,
                                ex.getMessage());
        }

        @ExceptionHandler(IllegalArgumentException.class)
        public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {

                return buildResponse(
                                HttpStatus.BAD_REQUEST,
                                ex.getMessage());
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<Map<String, Object>> handleValidationErrors(
                        MethodArgumentNotValidException ex) {

                Map<String, String> errors = new HashMap<>();

                ex.getBindingResult()
                                .getFieldErrors()
                                .forEach(error -> errors.put(
                                                error.getField(),
                                                error.getDefaultMessage()));

                Map<String, Object> response = new HashMap<>();

                response.put(
                                "timestamp",
                                LocalDateTime.now());

                response.put(
                                "status",
                                HttpStatus.BAD_REQUEST.value());

                response.put(
                                "error",
                                "Validation Failed");

                response.put(
                                "messages",
                                errors);

                return ResponseEntity
                                .status(HttpStatus.BAD_REQUEST)
                                .body(response);
        }

        @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
        public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceeded(
                        org.springframework.web.multipart.MaxUploadSizeExceededException ex) {

                return buildResponse(
                                HttpStatus.BAD_REQUEST,
                                "File size exceeds the allowed limit (maximum 10 MB)");
        }

        @ExceptionHandler(NoResourceFoundException.class)
        public ResponseEntity<Map<String, Object>> handleNoResourceFound(
                        NoResourceFoundException ex) {

                return buildResponse(
                                HttpStatus.NOT_FOUND,
                                ex.getMessage());
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex) {

                /*
                 * Print the actual exception and full stack trace
                 * in the STS Console for debugging.
                 */
                ex.printStackTrace();

                return buildResponse(
                                HttpStatus.INTERNAL_SERVER_ERROR,
                                ex.getMessage());
        }

        private ResponseEntity<Map<String, Object>> buildResponse(
                        HttpStatus status,
                        String message) {

                Map<String, Object> response = new HashMap<>();

                response.put(
                                "timestamp",
                                LocalDateTime.now());

                response.put(
                                "status",
                                status.value());

                response.put(
                                "error",
                                status.getReasonPhrase());

                response.put(
                                "message",
                                message);

                return ResponseEntity
                                .status(status)
                                .body(response);
        }
        
        @ExceptionHandler(M4PaymentRiskException.class)
        public ResponseEntity<Map<String, Object>> handleM4PaymentRiskException(
                M4PaymentRiskException ex) {

            HttpStatus status;

            switch (ex.getErrorCode()) {

                case "INVALID_INPUT":
                    status = HttpStatus.BAD_REQUEST;
                    break;

                case "MODEL_NOT_FOUND":
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    break;

                case "PREDICTION_ERROR":
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    break;

                case "AI_SERVICE_UNAVAILABLE":
                    status = HttpStatus.SERVICE_UNAVAILABLE;
                    break;

                default:
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    break;
            }

            return buildResponse(
                    status,
                    ex.getMessage());
        }
        
}
