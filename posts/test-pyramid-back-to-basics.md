---
title: Back to Basics: The Test Pyramid, and Why Your Architecture Might Want a Different Shape
excerpt: Every test strategy deck has a triangle on it somewhere. The pyramid is still good advice, but it was drawn for a world where most of the risk lived inside one codebase. Microservices and front ends keep their risk in different places, and the shape of the test suite should follow the risk, not the slide.
date: 2026-10-30
image: img/blog/test-pyramid-back-to-basics/cover.png
---

Every test strategy deck has a triangle on it somewhere. Usually around slide three, right after "Why quality matters" and just before the slide where someone proposes a new tool. It's wide at the bottom, narrow at the top, and everyone nods at it, because the test pyramid is one of the few things in our industry nearly everyone agrees with.

Then the next year someone draws a trophy. Then a honeycomb. Then a diamond. Testing must be the only discipline where geometry and dessert get equal billing (we'll get to the ice cream cone).

So, back to basics. What the pyramid actually says, why it works, where it stops fitting, and whether pointing your testing effort somewhere else gives you a better guarded system or just a differently shaped slide.

## The traditional pyramid

The test pyramid is usually credited to Mike Cohn, who described it in [*Succeeding with Agile*](https://www.mountaingoatsoftware.com/books/succeeding-with-agile-software-development-using-scrum) (2009). His version had three layers:

- **Unit tests** at the bottom: lots of them, small, fast, testing one piece of code in isolation.
- **Service tests** in the middle: fewer of them, testing behaviour through an API rather than the UI.
- **UI tests** at the top: a handful, driving the real interface end to end.

The argument is about economics. As you go up the pyramid, tests get slower, more expensive to write, more brittle to maintain, and harder to diagnose when they fail. A unit test that fails tells you which function is wrong. An end-to-end test that fails tells you that *something, somewhere* is wrong, and you're welcome to spend the afternoon finding out what.

So you push each check as low as it can meaningfully go. If a pricing rule can be tested with a unit test in two milliseconds, don't test it by logging into the app, adding things to a basket and reading the total off the screen.

Ham Vocke's [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) on Martin Fowler's site is still the best long read on this, and it makes two points that get lost when the pyramid is shrunk down to a slide:

- **The layer names don't matter much.** Teams argue for hours about what counts as an "integration test". The useful idea is the ratio: many small, fast, focused tests, fewer big, slow, broad ones.
- **Don't duplicate.** If a lower layer already covers something, a higher test checking the same thing adds cost without adding confidence.

### The ice cream cone

The pyramid's famous evil twin is the **ice cream cone**, a name popularised by Alister Scott: a few unit tests, some integration tests, a huge pile of UI tests on top, and a scoop of manual testing on the very top. It looks great in the sun. Then it melts.

You've probably seen one. The suite takes forty minutes, a third of the failures are timing issues, and the team has quietly agreed that a red build means "run it again". Most of the advice about the pyramid is really advice about not ending up here.

## What the pyramid is really saying

Strip away the triangle and the pyramid is making one claim:

> **Catch each kind of risk at the cheapest layer that can actually catch it.**

That's it. The shape is a consequence of that rule, applied to a particular kind of system. And the system it was drawn for was, roughly, a monolith: one codebase, one deployable, a database, and a UI on top. In that world, most of the interesting things that could go wrong (business rules, calculations, validation, state transitions) live *inside* the code. Unit tests can reach them, so unit tests are where the bulk of the effort goes. The pyramid follows naturally.

The question this post is really about is what happens when the risk moves.

## Microservices: the risk is in the neighbours

Split that monolith into a dozen small services and something interesting happens to where things go wrong.

Each service, on its own, tends to be fairly simple. Take an API call, validate it, read or write some data, publish an event, call a neighbour. There's often not much logic inside that could break on its own. What *can* break is everything around the edges:

- A neighbour renames a field, or starts returning a new enum value nobody handles.
- An event is published with a slightly different shape, or in a different order.
- A database migration changes what a query returns.
- A timeout, a retry and an idempotency bug turn one payment into two.
- The rule behind a perfectly valid 200 response changes, and nobody downstream notices (I went down that rabbit hole in [the mock vs real post](field-notes/mock-vs-real-tradeoff/)).

Unit tests can't see any of this. You can have 95% line coverage on every service and still ship a system where the services disagree about what an order looks like. In microservices, a large part of the risk lives *between* services rather than inside them.

### Spotify's honeycomb

This is the argument Spotify made in [Testing of Microservices](https://engineering.atspotify.com/2018/01/testing-of-microservices) (André Schaffer, 2018). They went as far as saying the traditional pyramid can be "actively harmful" for microservices, and proposed the **testing honeycomb** instead. It has three kinds of test:

- **Implementation detail tests** (small, at one end): unit tests, kept for code that is genuinely isolated and has real internal complexity of its own. Their example is parsing build logs, where there are plenty of awkward cases worth testing directly.
- **Integration tests** (the big middle): the main focus. Start the service for real, with a real database or message bus, send it inputs through its actual API and check what comes out the other side. Test the service from its edges, in isolation from other services.
- **Integrated tests** (small, at the other end): tests that pass or fail depending on whether *another* system is correct. Spinning up the neighbours locally, testing against a shared environment, one team's change breaking another team's suite. Spotify's advice was to have as few as possible, ideally none.

The reasoning is persuasive. When a service is small, a big pile of unit tests mostly locks in *how* the code is written rather than *what* it does. Refactor the internals and dozens of tests break even though behaviour didn't change, which slows you down without making you any safer. Tests at the service's edges survive refactoring, exercise the real database and serialisation, and fail for reasons you actually care about.

The honeycomb tests each service thoroughly through its edges. But notice what it deliberately avoids: depending on the neighbours. That's where **contract testing** comes in. A consumer-driven contract pins down what one service expects from another, and the provider verifies it in its own pipeline. You get the protection of "these two services agree" without the fragility of booting both of them in one test. If the honeycomb is the shape of each cell, contracts are the wax between the cells.

### What a microservice suite might look like

A hypothetical orders service, with illustrative numbers:

- **~40 implementation detail tests** for the discount engine and the address normaliser, the two parts with real logic in them.
- **~120 service-level integration tests**, each starting the service with a real Postgres in a container and a stubbed message bus, hitting the API, and checking the response, the stored row and the published event.
- **Contracts with its four neighbours**, verified on every build on both sides.
- **No tests that need the payment or inventory service to be running.**

Compared with a classic pyramid for the same service (say 600 unit tests mocking the repository layer at every turn), this suite has fewer tests, takes a bit longer to run, and catches a very different class of bug. Every one of those 120 tests would notice if a JSON field were renamed. Most of the 600 wouldn't.

## Front end: the risk is in the experience

Now go to the other end of the stack.

A modern front end has plenty of code, but much of the risk isn't in any single function. It's in how things come together:

- The component renders fine on its own, then breaks when it receives real data from the API.
- The form validates correctly, but the submit button is hidden behind a cookie banner on a small screen.
- State gets out of sync between two components after the user clicks back.
- A dependency upgrade changes how a date picker behaves, in one browser.
- Everything works, but a screen reader user can't reach the checkout button.

A pure unit test of a React component, with every child mocked and every hook stubbed, tells you surprisingly little about any of that. The user doesn't experience your components one at a time. They experience the whole page, in a real browser, at whatever window size they happen to be using.

### The testing trophy

Kent C. Dodds made this argument with the [testing trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) in 2018, borrowing Guillermo Rauch's line: *"Write tests. Not too many. Mostly integration."* From the bottom up:

- **Static analysis** as the base: TypeScript, ESLint. A whole category of bugs (typos, wrong types, a missing prop) caught before a single test runs, almost for free.
- **Unit tests**: a modest layer, for pure logic like formatters, reducers and validation helpers.
- **Integration tests** as the widest part: render real components together, interact with them the way a user would (Testing Library's whole philosophy), and assert on what the user would see. Mock the network, not your own components.
- **End-to-end tests** at the top: the real app in a real browser, against a real or realistic back end.

### So should front ends do more end-to-end?

Mostly yes, with a caveat.

The case for more e2e on the front end is stronger than it used to be. A lot of the old pain came from the tools: Selenium-era suites with sleeps everywhere and a flaky rate that would make you weep. Tools like Playwright and Cypress, with auto-waiting, built-in tracing, parallel runs and multiple browsers, have made e2e tests noticeably cheaper to write and less flaky to run. The cost curve that justified a very narrow pyramid top has flattened a bit.

And for a front end, the browser is where the risk is. Layout, routing, real network timing, cookies, browser quirks, accessibility: you only see those in a real browser.

The caveat: e2e tests still aren't free. They're still slower and harder to debug than the layers below them, and a front end with 800 e2e tests is an ice cream cone with better tooling. The efficient version looks more like this:

- **E2E for the critical journeys**: sign-up, login, search, checkout, whatever makes money or would make the news if it broke. Run them on every PR if you can, and in more than one browser.
- **Component integration tests for everything else**: the edge cases, error states and validation messages. They're faster, and they don't need a back end.
- **Visual regression and accessibility checks** on the key pages, because "it works but it looks broken" is still broken.
- **Unit tests for the genuinely logical bits**, and no more.

## Other shapes, briefly

The shape list keeps growing, and most of them are the same rule applied to a different system:

- **A data pipeline** carries most of its risk in the data itself: schema drift, nulls, duplicates, a late file. The most valuable tests are often data quality checks on real batches, not code tests at all.
- **A thin wrapper around a third-party API** has almost no logic of its own. Its risk is the third party, so contract tests and a scheduled check against their sandbox are worth more than any number of unit tests.
- **A rules-heavy back end** (pricing, tax, insurance, eligibility) really is the classic pyramid. Lots of logic, mostly inside, and unit tests are the cheapest way to cover it. Don't let anyone talk you out of a pyramid here just because honeycombs are fashionable.

| | Where most of the risk lives | Shape that fits | Where most of the effort goes |
|---|---|---|---|
| Logic-heavy monolith | Business rules inside the code | Pyramid | Unit tests |
| Microservice | Between services: APIs, events, data | Honeycomb | Service-level integration + contracts |
| Front end | Composition, browser, the user's experience | Trophy | Component integration + e2e on critical journeys |
| Data pipeline | The data itself | Whatever catches bad data | Data quality checks |
| Third-party wrapper | The third party | Mostly contracts | Contract and sandbox checks |

![Three shapes side by side: a pyramid for a logic-heavy system, where risk lives inside the code (unit, service/API, E2E/UI); a honeycomb for microservices, where risk lives between services (implementation detail, service integration, integrated); and a trophy for the front end, where risk lives in the experience (static, unit, component integration, critical E2E). Test each risk at the cheapest layer that can catch it](img/blog/test-pyramid-back-to-basics/three-shapes.png)

## Is a different focus actually better?

This is the real question. Changing the shape isn't automatically an improvement. It's worth asking what "better" means here, and I think it comes down to two things.

**Efficiency: confidence per unit of cost.** Cost isn't just CI minutes. It's time to write a test, time to maintain it when the code changes, time to diagnose a failure, and time lost to false alarms. Measured that way, a well-chosen shape usually wins clearly:

- Tests at the service's edges survive refactoring. Fewer tests break for reasons nobody cares about, so maintenance drops.
- Tests that match where the risk is fail for real reasons. Fewer false alarms means people take a red build seriously again.
- You stop paying for coverage of things that rarely break, and start paying for things that do.

The flip side is that service-level and e2e tests are slower per test. A honeycomb suite is usually smaller but each test takes longer, so the total time can go either way. It's worth measuring rather than assuming.

**Protection: does it guard the whole system?** Here the answer is more nuanced, and it's the part that's easy to miss.

Every shape above is a shape for **one component**. A honeycomb tests each service well, in isolation. A trophy tests the front end well, against a mocked network. And if every team gets its own shape exactly right, you can still end up with a system where:

- Every service passes its own integration tests.
- Every contract verifies.
- The front end's integration tests pass against a mocked API.
- And a user still can't check out, because of a config value in staging, a feature flag mismatch, or a sequence of three services that no single contract covers.

Nobody owns the gap between the shapes. The pyramid had a top layer whose job was to cover exactly that, and in the excitement of moving to honeycombs it's easy to delete it entirely.

So my answer is yes, a different focus is more efficient *and* guards the system better, but only if you stop thinking about one shape for the whole product. A real product is a front end plus a set of services plus some data, and each part deserves the shape that fits its risk. On top of all of them you still need a thin, deliberate, system-level layer:

- **A small set of end-to-end journeys across the real system**: a handful, owned by someone, covering the paths that make money. These are the only tests that check the pieces actually fit together.
- **Contracts at every service boundary**, so the system-level layer doesn't have to catch integration bugs one slow test at a time.
- **Synthetic checks and monitoring in production**, running those same critical journeys against the live system every few minutes. Some things only exist in production, and the cheapest place to catch them is right after a deploy, before a customer does.

Done well, the whole thing looks less like one shape and more like a small city: a pyramid here, a honeycomb there, a trophy at the front, and a few roads joining them up that someone actually maintains.

![A testing city: a rules engine with a pyramid, orders and payments with a honeycomb, a web app with a trophy and a data pipeline with data checks, joined by contracts and critical end-to-end journeys, all inside a ring of synthetic checks and monitoring. Right shape per component, thin protection across the system](img/blog/test-pyramid-back-to-basics/testing-city.png)

## How to find your own shape

You don't need a whiteboard and a new diagram. You need to know where your bugs come from.

1. **Look at where defects actually came from.** Take the last few months of escaped defects and incidents and tag each one: was it logic inside a component, an integration between components, the UI and browser, data, or configuration and environment? If you already track where defects get caught (I covered that in [the quality metrics post](field-notes/quality-metrics-for-cto-and-head-of-qa/)), you're most of the way there.
2. **Look at what your tests actually cost.** Which layers are slowest, flakiest and break most often for reasons that aren't real bugs? Tagging tests by layer makes this a filter rather than an investigation.
3. **Compare the two.** If most of your incidents are integration problems and most of your test effort is unit tests mocking the integrations away, that's your answer. If most of your bugs are logic errors and you're running 400 e2e tests, that's also your answer.
4. **Move effort gradually.** Don't delete a thousand unit tests in a week. Add contracts at the boundary that hurt most, convert a few heavily mocked tests to service-level ones, and watch whether escaped defects in that area go down.
5. **Re-check every so often.** Architectures drift. A service that started as a thin wrapper grows a pricing engine, and suddenly a pyramid makes sense for that part again.

And a couple of traps to avoid:

- **Treating a shape as a target.** "We're a honeycomb shop now" is just as much a cargo cult as "70% unit, 20% integration, 10% e2e". The ratio is an output of where your risk is, not an input.
- **Using a new shape as permission to stop unit testing.** The honeycomb still has implementation detail tests. If a service has a gnarly algorithm in it, unit test that algorithm.
- **Forgetting that someone has to own the gaps.** If every team owns its own shape and nobody owns the system journeys, the gaps are exactly where the next incident will come from.

## Wrapping up

The test pyramid isn't wrong. It's a very good answer to a specific question: "where should the tests go in a system whose risk lives mostly inside the code?" Ask that question about a different system and you get a different answer.

For microservices, the risk lives with the neighbours, so test each service from its edges and put contracts on the boundaries: Spotify's honeycomb. For front ends, the risk lives in what the user actually experiences, so test components together and give the critical journeys real browser coverage: the trophy, with a bit more weight at the top than it used to have. For logic-heavy code, the classic pyramid still works.

And whatever shape each part ends up with, keep a thin layer that tests the whole thing together, because the user doesn't care which shape your tests are. They just want the checkout button to work.
