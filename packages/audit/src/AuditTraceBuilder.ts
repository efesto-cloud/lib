import { randomUUID } from "node:crypto";
import { Metadata } from "@efesto-cloud/metadata";
import { DateTime } from "luxon";
import type { AuditTrace, AuditVerb, IAuditActor } from "./types.js";
import { AuditTraceValidationError } from "./types.js";

/**
 * Builder for constructing audit traces.
 *
 * Use this to incrementally set trace properties, then call build() to create
 * the final trace object. Typically accessed via AsyncLocalStorage in the
 * audit decorator context.
 *
 * @template TActor - The actor type(s) for this trace
 *
 * @example
 * ```typescript
 * const builder = new AuditTraceBuilder<UserActor>();
 * builder
 *   .setActor({ type: "USER", payload: { id: "123", email: "user@example.com" } })
 *   .setUsecase("CreatePost")
 *   .setEntity("Post")
 *   .setEntityId("post-456")
 *   .setTitle("New Post Created")
 *   .setVerb("CREATE");
 *
 * const trace = builder.build();
 * ```
 */
export class AuditTraceBuilder<TActor extends IAuditActor = IAuditActor> {
    private _id: string = randomUUID();
    private actor: TActor | null = null;
    private usecase: string | null = null;
    private entity: string | null = null;
    private entity_id: string | null = null;
    private metadata: Metadata = Metadata.create();
    private timestamp: DateTime | undefined = undefined;
    private expire_at: DateTime<true> | null = null;
    private title: string | null = null;
    private verb: AuditVerb | null = null;

    /**
     * Get the unique identifier for this trace.
     */
    getId(): string {
        return this._id;
    }

    /**
     * Get the current actor (null if not set).
     */
    getActor(): TActor | null {
        return this.actor;
    }

    /**
     * Get the use case identifier (null if not set).
     */
    getUsecase(): string | null {
        return this.usecase;
    }

    /**
     * Get the entity type (null if not set).
     */
    getEntity(): string | null {
        return this.entity;
    }

    /**
     * Get the entity instance ID (null if not set).
     */
    getEntityId(): string | null {
        return this.entity_id;
    }

    /**
     * Get the action timestamp (null if not set).
     */
    getTimestamp(): DateTime | null {
        return this.timestamp ?? null;
    }

    /**
     * Get the expiration timestamp (null if not set).
     */
    getExpireAt(): DateTime<true> | null {
        return this.expire_at;
    }

    /**
     * Get the metadata object for adding custom key-value pairs.
     */
    getMetadata(): Metadata {
        return this.metadata;
    }

    /**
     * Get the action title (null if not set).
     */
    getTitle(): string | null {
        return this.title;
    }

    /**
     * Get the action verb (null if not set).
     */
    getVerb(): AuditVerb | null {
        return this.verb;
    }

    /**
     * Set the actor who performed the action.
     *
     * @param actor - The actor object (or null for anonymous/system actions)
     */
    setActor(actor: TActor | null): this {
        this.actor = actor;
        return this;
    }

    /**
     * Set the use case identifier.
     *
     * @param usecase - Use case name/identifier
     */
    setUsecase(usecase: string): this {
        this.usecase = usecase;
        return this;
    }

    /**
     * Set the entity type being acted upon.
     *
     * @param entity - Entity class (extracts name) or string identifier
     */
    setEntity(entity: { constructor: { name: string } } | string): this {
        if (typeof entity === "string") {
            this.entity = entity;
        } else if ("constructor" in entity && "name" in entity.constructor) {
            this.entity = entity.constructor.name;
        }
        return this;
    }

    /**
     * Set the specific entity instance ID.
     *
     * @param id - Entity instance identifier (optional)
     */
    setEntityId(id?: string): this {
        this.entity_id = id ?? null;
        return this;
    }

    /**
     * Set the action timestamp.
     *
     * @param timestamp - DateTime object (defaults to now if not provided)
     */
    setTimestamp(timestamp?: DateTime): this {
        this.timestamp = timestamp ?? DateTime.now();
        return this;
    }

    /**
     * Set the expiration timestamp for TTL.
     *
     * @param expire_at - DateTime object (or null for no expiration)
     */
    setExpireAt(expire_at?: DateTime<true> | null): this {
        this.expire_at = expire_at ?? null;
        return this;
    }

    /**
     * Set metadata entries.
     *
     * @param metadata - Metadata object with entries to merge
     */
    setMetadata(metadata: Metadata): this {
        for (const [key, value] of metadata.entries()) {
            this.metadata.set(key, value);
        }
        return this;
    }

    /**
     * Set the human-readable action title.
     *
     * @param title - Action description
     */
    setTitle(title: string): this {
        this.title = title;
        return this;
    }

    /**
     * Set the action verb.
     *
     * @param verb - Action verb (e.g., "CREATE", "UPDATE")
     */
    setVerb(verb: AuditVerb): this {
        this.verb = verb;
        return this;
    }

    /**
     * Build the final audit trace object.
     *
     * @throws {AuditTraceValidationError} If required fields are missing
     * @returns The complete audit trace ready for persistence
     */
    build(): AuditTrace<TActor> {
        const missingFields: string[] = [];

        if (!this.usecase) missingFields.push("usecase");
        if (!this.entity) missingFields.push("entity");
        if (!this.title) missingFields.push("title");
        if (!this.verb) missingFields.push("verb");

        if (missingFields.length > 0) {
            throw new AuditTraceValidationError(missingFields);
        }

        const timestamp = (this.timestamp ?? DateTime.now()).toISO();
        if (!timestamp) {
            throw new AuditTraceValidationError([
                "timestamp (invalid DateTime)",
            ]);
        }

        return {
            _id: this._id,
            actor: this.actor,
            usecase: this.usecase!,
            entity: this.entity!,
            entity_id: this.entity_id,
            timestamp,
            expire_at: this.expire_at?.toISO() ?? null,
            metadata: this.metadata.toDTO(),
            title: this.title!,
            verb: this.verb!,
        };
    }
}
