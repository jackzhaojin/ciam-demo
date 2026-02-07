package com.poc.claims.repository;

import com.poc.claims.model.ClaimEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClaimEventRepository extends JpaRepository<ClaimEvent, UUID> {

    List<ClaimEvent> findByClaimIdOrderByTimestampAsc(UUID claimId);
}
