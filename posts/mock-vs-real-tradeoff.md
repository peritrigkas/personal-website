---
title: Mock vs Real: Where the Trade-Off Actually Bites
excerpt: A mock is a promise about how a service behaves, a promise that breaks the moment the real thing changes and nobody's watching. Where mocks earn their keep, where contract testing closes the gap, and where only the real service will do.
date: 2026-09-15
image: img/blog/mock-vs-real-tradeoff/cover.jpg
---

A mock is a promise about how a service behaves. The moment the real service changes and the mock doesn't, that promise is broken, and your pipeline has no way of knowing.

## Why we mock in the first place

The case for mocking isn't really debatable: it's faster, it's reliable, and it decouples your test from everything you don't own. When I built a service module simulating one of our downstream dependencies, the point wasn't just speed, though spinning up the mock was faster than the real service in the pipeline. The real point was **isolation**. A test that only needs to know your service sends the right request and handles the right response shape doesn't need a real database, a real network hop, or someone else's staging environment to be up. Mock it, and a flaky third-party outage stops being your problem at 2am.

The cost is what the mock doesn't know. It's a snapshot of your assumptions at the time you wrote it, and it stays frozen while the real service keeps moving. A field that used to be optional becomes required. An error code that used to be a 400 becomes a 422. None of that shows up in your suite, because the suite is still asking the mock, not the service. A bug I ran into once was almost the mirror image of this: a mocked cache client had no **eviction logic** at all, so a value that should have expired within minutes just sat there indefinitely in every test run. The real cache aged it out under load and started serving fresh reads where the code still expected the old value, and the mismatch only surfaced under a narrow timing window nobody had thought to write a test for. Nothing failed loudly. It just let the wrong thing through.

## Where a mock isn't the right call

That cache bug wasn't a one-off. There's a specific set of behaviours mocks tend to skip past entirely, and they're worth naming because they're exactly the kind that pass a mocked test cleanly and then break in production:

- **Serialization.** A mock hands back an in-memory object; the real service hands back bytes that have to be encoded, decoded, and schema-checked.
- **Key/value validation.** A test double stores whatever you give it. A real store might reject a malformed key or truncate one that's too long.
- **Eviction and TTL behaviour.** Mocks don't age data out. A value that should expire in five minutes just sits there for the whole test run.
- **Listener and callback execution.** A mock often returns success on publish without ever invoking anything downstream, so whether your subscriber logic actually runs goes untested.

A few more in the same bucket: connection pooling and timeouts, partial failure, and locking or concurrency. None of this is a reason to stop mocking. It's a reason to know exactly what you're not testing when you do.

![The contract only covers what someone remembered to specify; load, ordering, and state drift slip through underneath it](img/blog/mock-vs-real-tradeoff/contract-gap.jpg)

## Is contract testing enough?

Contract testing closes a real part of this gap. A **consumer-driven contract** says, concretely, "here's the shape of request I send and the response I expect," and a **provider-side verification** confirms the real service still honours it. When that's wired into both sides' pipelines, a provider can't silently change a response shape without a contract test failing somewhere, which is exactly the class of bug a plain mock can't catch.

It's not sufficient on its own, though. Contracts generally cover shape, not behaviour under load, ordering, or state; a contract doesn't know your endpoint is fine on the first call and wrong on the second. They only protect what someone remembered to write a contract for, so a new field or an undocumented edge case ships uncovered. And they only work if both sides actually run them and treat a failure as a blocker, not noise to wave through, the same discipline problem that lets a stale mock survive in the first place.

What actually tightens things beyond the contract itself:

- **A shared spec both sides treat as truth.** An OpenAPI or AsyncAPI definition that's the actual source for both the mock and the real implementation, not two teams' separate mental models of the same endpoint.
- **Cross-team visibility when something changes.** The provider team flags a breaking change before it ships, not after a contract test fails downstream, which is a collaboration habit, not a tooling problem.
- **Scheduled runs against the real thing.** Even a small number of nightly or pre-release smoke tests against the actual service catches the drift that contracts weren't written for.
- **Ownership on the alert.** Someone is actually notified and accountable when a provider's behaviour shifts, the same way Datadog anomaly detection means someone owns a latency spike rather than it quietly becoming normal.

None of this replaces **exploratory testing** either. The ambiguous, badly-described error responses I've found running Postman against real UAT environments weren't things a contract would have specified in the first place. Nobody wrote a contract for "this error message doesn't say what actually went wrong."

![Mocks run fast on every PR, contracts verify the shape between teams, and scheduled runs against the real service catch what neither one was written to see](img/blog/mock-vs-real-tradeoff/pipeline-lanes.jpg)

## Where each one earns its place

Mocks belong in unit tests, component tests, and most of what runs on a PR, anywhere the question is "does my logic do the right thing," not "does the integration actually work." That's most of a pipeline, and it should stay fast.

Real services belong in staging, in a lean set of end-to-end smoke tests before a release, and in scheduled runs that aren't gating every commit but do run often enough to catch drift early. That stale-cache defect only got confirmed once someone stepped through the real behaviour under real timing. No amount of mock coverage would have surfaced it, because the mock was the thing that was wrong.

The rule I actually use: **mock for velocity, use the real thing for truth**, and treat contract testing as the bridge between them, not a replacement for either.
