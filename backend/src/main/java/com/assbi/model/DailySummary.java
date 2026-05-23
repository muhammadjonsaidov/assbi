package com.assbi.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "daily_summaries")
public class DailySummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "summary_date", nullable = false)
    private LocalDate summaryDate;

    @Column(name = "camera_source", nullable = false, length = 500)
    private String cameraSource;

    @Column(name = "object_type", nullable = false, length = 20)
    private String objectType;

    @Column(name = "count_in", nullable = false)
    private Integer countIn = 0;

    @Column(name = "count_out", nullable = false)
    private Integer countOut = 0;

    public DailySummary() {}

    public Long getId() { return id; }
    public LocalDate getSummaryDate() { return summaryDate; }
    public String getCameraSource() { return cameraSource; }
    public String getObjectType() { return objectType; }
    public Integer getCountIn() { return countIn; }
    public Integer getCountOut() { return countOut; }

    public void setSummaryDate(LocalDate summaryDate) { this.summaryDate = summaryDate; }
    public void setCameraSource(String cameraSource) { this.cameraSource = cameraSource; }
    public void setObjectType(String objectType) { this.objectType = objectType; }
    public void setCountIn(Integer countIn) { this.countIn = countIn; }
    public void setCountOut(Integer countOut) { this.countOut = countOut; }
}
