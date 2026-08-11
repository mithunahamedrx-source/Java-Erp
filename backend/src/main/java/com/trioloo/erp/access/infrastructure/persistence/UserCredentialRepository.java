package com.trioloo.erp.access.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Credential lookup, used only during authentication.
 *
 * <p>Separate from {@link UserProfileRepository} so that reading an identity never joins to
 * a password hash.
 */
public interface UserCredentialRepository extends JpaRepository<UserCredentialEntity, UUID> {
}
