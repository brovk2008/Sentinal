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

## 6. Advanced Link Analysis & Entity Resolution
* **Entity Resolution Engine**: Implement probabilistic record linkage algorithms (like deduplication using Fellegi-Sunter methodology or machine-learning-based classification) to identify when different spellings or records refer to the same individual across separate data sources.
* **Graph Database Infrastructure**: Migrate the connection networks from static SQLite queries to dedicated graph databases (such as **Neo4j** or **Amazon Neptune**) to support real-time multi-hop relationship queries and graph algorithms (e.g., PageRank, Louvain community detection).

## 7. Automated Data Pipeline & ETL Orchestration
* **Workflow Orchestration**: Use tools like **Apache Airflow**, **Prefect**, or **Dagster** to schedule, monitor, and run automated data extraction, transformation, and loading (ETL) pipelines.
* **Stream Processing**: Transition from batch updates to event-driven processing using message brokers like **Apache Kafka** or **RabbitMQ** to ingest and vectorize new data points in real time.

## 8. Continuous Model Training (MLOps)
* **Model Registry and Monitoring**: Deploy platforms like **MLflow** to track model versions, registry, and monitor drift for predictive classification and text categorization models.
* **Distributed Training**: Scale feature extraction pipelines to use distributed processing frameworks like **Apache Spark** for large-scale document analysis.
