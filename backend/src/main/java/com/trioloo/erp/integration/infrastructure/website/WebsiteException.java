package com.trioloo.erp.integration.infrastructure.website;

/** A website call that could not be completed. The message never carries the key or the request URL. */
public class WebsiteException extends RuntimeException {

    public WebsiteException(String message) {
        super(message);
    }
}
