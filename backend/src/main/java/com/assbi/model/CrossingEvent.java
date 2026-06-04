package com.assbi.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "crossing_events")
public class CrossingEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(name = "track_id", nullable = false)
    private Integer trackId;

    @Column(name = "object_type", nullable = false, length = 20)
    private String objectType;

    @Column(nullable = false, length = 3)
    private String direction;

    @Column(name = "position_x", precision = 8, scale = 2)
    private BigDecimal positionX;

    @Column(name = "position_y", precision = 8, scale = 2)
    private BigDecimal positionY;

    @Column(name = "camera_source", nullable = false, length = 500)
    private String cameraSource;

    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    public CrossingEvent() {}

    public CrossingEvent(Instant timestamp, Integer trackId, String objectType,
                         String direction,
                         BigDecimal positionX, BigDecimal positionY,
                         String cameraSource, BigDecimal confidence) {
        this.timestamp    = timestamp;
        this.trackId      = trackId;
        this.objectType   = objectType;
        this.direction    = direction;
        this.positionX    = positionX;
        this.positionY    = positionY;
        this.cameraSource = cameraSource;
        this.confidence   = confidence;
    }

    public Long       getId()           { return id; }
    public Instant    getTimestamp()    { return timestamp; }
    public Integer    getTrackId()      { return trackId; }
    public String     getObjectType()   { return objectType; }
    public String     getDirection()    { return direction; }
    public BigDecimal getPositionX()    { return positionX; }
    public BigDecimal getPositionY()    { return positionY; }
    public String     getCameraSource() { return cameraSource; }
    public BigDecimal getConfidence()   { return confidence; }
}
