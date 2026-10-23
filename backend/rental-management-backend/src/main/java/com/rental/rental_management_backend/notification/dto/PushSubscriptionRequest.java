package com.rental.rental_management_backend.notification.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class PushSubscriptionRequest {

    @NotBlank
    @Size(max = 2048)
    @Pattern(regexp = "^https://[^\\s]+$", message = "Endpoint must use HTTPS")
    private String endpoint;

    @NotNull
    @Valid
    private SubscriptionKeys keys;

    @Size(max = 20)
    @Pattern(regexp = "WEB", message = "Only browser Web Push is supported")
    private String deviceType = "WEB";

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    @AssertTrue(message = "Endpoint must be an HTTPS browser push service URL")
    public boolean isSupportedEndpoint() {
        if (endpoint == null || endpoint.isBlank()) {
            return true;
        }

        try {
            java.net.URI uri = java.net.URI.create(endpoint);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || host == null
                    || uri.getRawUserInfo() != null
                    || uri.getFragment() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)) {
                return false;
            }

            String normalizedHost = host.toLowerCase(java.util.Locale.ROOT);
            return normalizedHost.equals("fcm.googleapis.com")
                    || normalizedHost.endsWith(".fcm.googleapis.com")
                    || normalizedHost.equals("push.services.mozilla.com")
                    || normalizedHost.endsWith(".push.services.mozilla.com")
                    || normalizedHost.equals("notify.windows.com")
                    || normalizedHost.endsWith(".notify.windows.com")
                    || normalizedHost.equals("push.apple.com")
                    || normalizedHost.endsWith(".push.apple.com");
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public SubscriptionKeys getKeys() {
        return keys;
    }

    public void setKeys(SubscriptionKeys keys) {
        this.keys = keys;
    }

    public String getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(String deviceType) {
        this.deviceType = deviceType;
    }

    public static class SubscriptionKeys {

        @NotBlank
        @Size(max = 256)
        @Pattern(regexp = "^[A-Za-z0-9_-]+={0,2}$")
        private String p256dh;

        @NotBlank
        @Size(max = 128)
        @Pattern(regexp = "^[A-Za-z0-9_-]+={0,2}$")
        private String auth;

        public String getP256dh() {
            return p256dh;
        }

        public void setP256dh(String p256dh) {
            this.p256dh = p256dh;
        }

        public String getAuth() {
            return auth;
        }

        public void setAuth(String auth) {
            this.auth = auth;
        }
    }
}
