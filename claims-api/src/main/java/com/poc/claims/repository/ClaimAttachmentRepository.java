package com.poc.claims.repository;

import com.poc.claims.model.ClaimAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClaimAttachmentRepository extends JpaRepository<ClaimAttachment, UUID> {

    List<ClaimAttachment> findByClaimIdOrderByCreatedAtDesc(UUID claimId);

    Optional<ClaimAttachment> findByIdAndClaimId(UUID id, UUID claimId);
}
