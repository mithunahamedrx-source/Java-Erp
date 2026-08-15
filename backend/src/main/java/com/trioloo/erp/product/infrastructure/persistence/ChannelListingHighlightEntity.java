package com.trioloo.erp.product.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * One channel-facing highlight authored for a Channel Listing, {@code PRD-198}.
 *
 * <p>🔴 {@code PRD-198.c} — the presence of ANY row here means the Listing holds its own
 * ordered set and that set is the effective one. Absence means the effective highlights fall
 * back to the mapped Sellable Product's master set. ⚠ ALL-OR-NOTHING: the fallback is never
 * copied into this table, exactly as media never is ({@code PRD-170.b}).
 *
 * <p>🔴 {@code PRD-164.b} / {@code PRD-198.b} — {@link #position} is the AUTHORED sequence.
 * It is never inferred from insertion order, identifier order or storage order; a marketing
 * order the operator chose must survive a re-save.
 *
 * <p>🔴 {@code PRD-198.e} — an adapter that cannot carry highlights NEVER causes these rows
 * to be deleted. Unsupported means "not sent", never "discard what was written".
 */
@Entity
@Table(name = "channel_listing_highlight")
public class ChannelListingHighlightEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "channel_listing_id", nullable = false, updatable = false)
    private UUID channelListingId;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "highlight_text", nullable = false)
    private String highlightText;

    /**
     * {@code PRD-202.b} — {@code EN} or {@code BN}.
     *
     * <p>🔴 {@code PRD-202.f} — the sets fall back ALL-OR-NOTHING. A {@code BN} set that
     * exists is the effective Bangla set entirely; where none exists the {@code EN} set is
     * used entirely. ⚠ There is NO per-line merge — a half-translated list in marketplace
     * order reads as a mistake to every Bangla shopper.
     *
     * <p>🔴 {@code PRD-202.d} — the fallback is never copied into {@code BN} rows.
     */
    @Column(name = "language", nullable = false, length = 2)
    private String language;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected ChannelListingHighlightEntity() {
    }

    public ChannelListingHighlightEntity(UUID id, UUID channelListingId, String language,
                                         int position, String highlightText, UUID actorId,
                                         Instant now) {
        this.id = id;
        this.channelListingId = channelListingId;
        this.language = language;
        this.position = position;
        this.highlightText = highlightText;
        this.createdAt = now;
        this.createdBy = actorId;
        this.updatedAt = now;
        this.updatedBy = actorId;
    }

    public void reposition(int position, UUID actorId, Instant now) {
        this.position = position;
        this.updatedBy = actorId;
        this.updatedAt = now;
    }

    public UUID getId() { return id; }
    public UUID getChannelListingId() { return channelListingId; }
    public int getPosition() { return position; }
    public String getLanguage() { return language; }
    public String getHighlightText() { return highlightText; }
    public void setHighlightText(String v) { highlightText = v; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
