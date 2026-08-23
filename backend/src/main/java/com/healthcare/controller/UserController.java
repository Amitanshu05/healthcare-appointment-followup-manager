package com.healthcare.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {
    @GetMapping
    public String getUsers() {
        return "Users list";
    }
}
