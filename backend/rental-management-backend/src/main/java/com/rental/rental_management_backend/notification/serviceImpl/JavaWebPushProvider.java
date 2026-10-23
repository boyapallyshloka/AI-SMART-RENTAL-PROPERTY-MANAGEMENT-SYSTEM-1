package com.rental.rental_management_backend.notification.serviceImpl;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.Security;
import java.util.concurrent.ExecutionException;

import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.jose4j.lang.JoseException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.rental.rental_management_backend.notification.entity.UserDeviceToken;
import com.rental.rental_management_backend.notification.service.PushProvider;
import com.rental.rental_management_backend.notification.service.WebPushDeliveryException;

import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;

@Component
public class JavaWebPushProvider implements PushProvider {

    private final String publicKey;
    private final String privateKey;
    private final String subject;

    public JavaWebPushProvider(
            @Value("${webpush.vapid.public-key:}") String publicKey,
            @Value("${webpush.vapid.private-key:}") String privateKey,
            @Value("${webpush.vapid.subject:}") String subject) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
    }

    @Override
    public int send(UserDeviceToken subscription, String payload) {
        if (publicKey.isBlank() || privateKey.isBlank() || subject.isBlank()) {
            throw new WebPushDeliveryException(
                    "Web Push VAPID configuration is incomplete",
                    false,
                    null);
        }

        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }

            PushService pushService =
                    new PushService(publicKey, privateKey, subject);
            Notification notification = new Notification(
                    subscription.getEndpoint(),
                    subscription.getP256dhKey(),
                    subscription.getAuthKey(),
                    payload);

            HttpResponse response = pushService.send(notification);
            return response.getStatusLine().getStatusCode();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new WebPushDeliveryException(
                    "Web Push delivery was interrupted",
                    true,
                    exception);
        } catch (IOException | ExecutionException exception) {
            throw new WebPushDeliveryException(
                    "Web Push provider request failed",
                    true,
                    exception);
        } catch (GeneralSecurityException | JoseException exception) {
            throw new WebPushDeliveryException(
                    "Web Push subscription or VAPID key is invalid",
                    false,
                    exception);
        } catch (RuntimeException exception) {
            throw new WebPushDeliveryException(
                    "Web Push payload or provider configuration is invalid",
                    false,
                    exception);
        }
    }
}
