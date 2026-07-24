# Sentinel — Future Architectural Goals & Roadmap

This document outlines the standard engineering roadmap for transitioning the Sentinel local prototype into a secure, production-ready enterprise application.

## 1. Data Infrastructure & Storage
* **Migration to Production Databases**: Replace the current SQLite prototype database with a robust relational database management system (RDBMS) like **PostgreSQL** to support concurrent access, connection pooling, and advanced indexing.
* **Vector Database Separation**: Migrate from in-memory NumPy/JSON RAG embeddings to a dedicated vector store (e.g., **pgvector**, **Pinecone**, or **Milvus**) for faster, scalable semantic search queries.
* **Timeseries Data Handling**: Use specialized time-series databases or extensions for analyzing chronologically dense logs (such as mock CDR tower metadata).

## 2. Authentication, Authorization & Security
* **Role-Based Access Control (RBAC)**: Implement standard authorization levels (e.g., investigator, analyst, administrator) using frameworks like OAuth2 or OpenID Connect.
* **Encryption Standards**: Ensure all data is encrypted in transit using TLS/HTTPS and at rest using AES-256 encryption.
* **Audit Logging**: Maintain comprehensive, tamper-evident logs tracking all user queries, data modifications, and API access for accountability.

## 3. API Integrations & Data Sources
* **Official API Transition**: Replace custom HTML scraping scripts (which are prone to breakage when page structures change) with official, authenticated government open-data API feeds where available.
* **Standardized Schema Compliance**: Format data exchange models to conform with national and international public data standards.

## 4. Compliance & Data Governance
* **Regulatory Compliance**: Align data processing and retention policies with regional data protection regulations, such as India's Digital Personal Data Protection (DPDP) Act or standard enterprise privacy guidelines.
* **Data Minimization & Redaction**: Automatically redact personally identifiable information (PII) of victims or unrelated individuals from text fields before processing or indexing.

## 5. Deployment & Scalability
* **Containerization**: Package services using Docker containers to ensure consistent runtimes across different environments.
* **Orchestration & Load Balancing**: Deploy services on managed container orchestration platforms (like Kubernetes) to support automated scaling, health checks, and high availability.
