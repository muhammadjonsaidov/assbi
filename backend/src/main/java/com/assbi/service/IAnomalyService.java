package com.assbi.service;

import com.assbi.dto.AnomalyDto;

import java.util.List;

public interface IAnomalyService {
    List<AnomalyDto> detectAnomalies();
}