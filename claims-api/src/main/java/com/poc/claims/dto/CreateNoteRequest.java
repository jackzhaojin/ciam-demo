package com.poc.claims.dto;

import jakarta.validation.constraints.NotBlank;

public class CreateNoteRequest {

    @NotBlank
    private String content;

    public CreateNoteRequest() {}

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
