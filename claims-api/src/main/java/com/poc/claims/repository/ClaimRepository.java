package com.poc.claims.repository;

import com.poc.claims.model.Claim;
import com.poc.claims.model.ClaimStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClaimRepository extends JpaRepository<Claim, UUID> {

    Page<Claim> findByOrganizationId(UUID organizationId, Pageable pageable);

    Page<Claim> findByOrganizationIdAndStatus(UUID organizationId, ClaimStatus status, Pageable pageable);

    Optional<Claim> findByIdAndOrganizationId(UUID id, UUID organizationId);

    @Query("SELECT COUNT(c) FROM Claim c WHERE c.claimNumber LIKE :prefix%")
    long countByClaimNumberPrefix(@Param("prefix") String prefix);

    // Stats queries
    long countByOrganizationId(UUID organizationId);

    long countByOrganizationIdAndStatus(UUID organizationId, ClaimStatus status);

    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Claim c WHERE c.organizationId = :orgId AND c.status NOT IN :excludedStatuses")
    BigDecimal sumAmountByOrganizationIdAndStatusNotIn(@Param("orgId") UUID orgId, @Param("excludedStatuses") List<ClaimStatus> excludedStatuses);

    long countByOrganizationIdAndCreatedAtAfter(UUID organizationId, LocalDateTime after);

    // Risk signal queries
    long countByUserIdAndOrganizationIdAndCreatedAtAfter(UUID userId, UUID organizationId, LocalDateTime after);

    long countByUserIdAndOrganizationId(UUID userId, UUID organizationId);

    @Query(value = "SELECT AVG(c.amount) FROM claims c WHERE c.organization_id = :orgId AND c.type = :claimType", nativeQuery = true)
    BigDecimal findAverageAmountByOrganizationIdAndType(@Param("orgId") UUID orgId, @Param("claimType") String claimType);

    // For export
    List<Claim> findByOrganizationId(UUID organizationId);
}
