package com.assbi.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class SecurityHeadersFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse response = (HttpServletResponse) res;
        response.setHeader("X-Content-Type-Options",  "nosniff");
        response.setHeader("X-Frame-Options",          "DENY");
        response.setHeader("X-XSS-Protection",         "1; mode=block");
        response.setHeader("Referrer-Policy",          "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy",       "camera=(), microphone=(), geolocation=()");
        chain.doFilter(req, res);
    }
}