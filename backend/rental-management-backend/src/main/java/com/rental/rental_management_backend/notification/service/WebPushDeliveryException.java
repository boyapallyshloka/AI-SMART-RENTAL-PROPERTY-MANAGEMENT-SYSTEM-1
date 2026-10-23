package com.rental.rental_management_backend.notification.service;

public class WebPushDeliveryException extends RuntimeException {

    private final boolean retryable;

    public WebPushDeliveryException(
            String message,
            boolean retryable,
            Throwable cause) {
        super(message, cause);
        this.retryable = retryable;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
