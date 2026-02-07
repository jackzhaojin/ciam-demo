package com.poc.claims.repository;

import com.poc.claims.model.Claim;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClaimRepository extends JpaRepository<Claim, UUID> {

    Page<Claim> findByOrganizationId(UUID organizationId, Pageable pageable);

    Optional<Claim> findByIdAndOrganizationId(UUID id, UUID organizationId);

    @Query("SELECT COUNT(c) FROM Claim c WHERE c.claimNumber LIKE :prefix%")
    long countByClaimNumberPrefix(@Param("prefix") String prefix);
}
