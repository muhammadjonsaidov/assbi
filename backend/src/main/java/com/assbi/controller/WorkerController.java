package com.assbi.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/worker")
public class WorkerController {

    @Value("${assbi.root:..}")
    private String assbiRoot;

    @Value("${assbi.worker.log-file:logs/worker.log}")
    private String workerLogFile;

    private Process workerProcess;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        try {
            Path uploadDir = Path.of(System.getProperty("java.io.tmpdir"), "assbi-uploads");
            Files.createDirectories(uploadDir);
            String orig = file.getOriginalFilename();
            String safe = (orig != null ? orig : "upload").replaceAll("[^a-zA-Z0-9._-]", "_");
            Path dest = uploadDir.resolve(System.currentTimeMillis() + "_" + safe);
            file.transferTo(dest);
            return ResponseEntity.ok(Map.of("path", dest.toAbsolutePath().toString()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/start")
    public synchronized ResponseEntity<Map<String, Object>> start(@RequestParam String source) {
        if (workerProcess != null && workerProcess.isAlive()) {
            workerProcess.destroy();
        }
        try {
            File workerDir = new File(assbiRoot, "detection-worker");
            File pythonBin = new File(workerDir, "venv/bin/python");
            File log       = new File(assbiRoot, workerLogFile);
            log.getParentFile().mkdirs();

            ProcessBuilder pb = new ProcessBuilder(
                pythonBin.getAbsolutePath(), "main.py", "--source", source
            );
            pb.directory(workerDir);
            pb.redirectOutput(log);
            pb.redirectError(log);
            workerProcess = pb.start();

            return ResponseEntity.ok(Map.of("status", "started", "source", source));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/stop")
    public synchronized ResponseEntity<Map<String, Object>> stop() {
        if (workerProcess != null && workerProcess.isAlive()) {
            workerProcess.destroy();
            workerProcess = null;
            return ResponseEntity.ok(Map.of("status", "stopped"));
        }
        return ResponseEntity.ok(Map.of("status", "not_running"));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        boolean running = workerProcess != null && workerProcess.isAlive();
        return ResponseEntity.ok(Map.of("running", running));
    }
}
