package com.rental.rental_management_backend.notification.serviceImpl;

import java.util.Map;
import java.util.Set;

import com.rental.rental_management_backend.User.enums.RoleType;

final class PushDeepLink {

    private static final Map<RoleType, String> ROLE_ROUTES = Map.of(
            RoleType.TENANT, "tenant",
            RoleType.PROPERTY_OWNER, "owner",
            RoleType.PROPERTY_MANAGER, "manager");

    private static final Map<RoleType, Set<String>> SUPPORTED_ENTITY_TYPES =
            Map.of(
                    RoleType.TENANT,
                    Set.of(
                            "PROPERTY",
                            "MAINTENANCE",
                            "APPLICATION",
                            "RENT_INVOICE",
                            "PAYMENT"),
                    RoleType.PROPERTY_OWNER,
                    Set.of("PROPERTY", "MAINTENANCE", "APPLICATION", "PAYMENT"),
                    RoleType.PROPERTY_MANAGER,
                    Set.of("PROPERTY", "MAINTENANCE", "APPLICATION", "PAYMENT"));

    private PushDeepLink() {
    }

    static String create(RoleType role, String entityType, Long entityId) {
        String roleRoute = role == null ? null : ROLE_ROUTES.get(role);
        if (roleRoute == null
                || entityType == null
                || !SUPPORTED_ENTITY_TYPES.get(role).contains(entityType)
                || entityId == null
                || entityId <= 0) {
            return null;
        }

        return "/" + roleRoute + "/resolve?type=" + entityType
                + "&id=" + entityId;
    }
}
