# Workflows

Original Project Brief: [Workflows](https://linear.app/formbricks/project/workflows-ce94b3bbc18e/overview)

## Introduce Trigger -> Action workflows

# 1\. Summary

We're introducing versatile Trigger <> Condition <> Action workflows to unlock the third column of XM platforms: Action & Automation.

## 2\. Context / Why

- XM Platforms do three things: Gather data, Analyze & Report & Enable & Automate action
- Why now: With Javi onboard, we have the capacity to tackle this

+++ ## 3\. Goal / Success Criteria

- The workflows product is successful mostly due to a robust, versatile product & engineering design. Previously, we've built a monolythic, interdependent system that muddles concerns together (Surveying & Distribution, most prominently). The goal for Workflows has to be to design a system that is versatile enough to serve needs we know of today, but can be augmented and scaled as we learn more about our customers needs (and the changing product landscape due to AI).
- Workflows can be created & updated with natural language, APIs, & MCPs (Agents)
- Workflow UI is built with reusable, atomic components that enable easy augmentation. Also I really like the idea of deriving the UI from the workflow JSON (or a different approach to "Workflows as code") / a single source of truth rather than running into the same issues we have around the survey editor
- Workflows can be versioned incl. rollback / revert. Ideally, an audit log is kept, but can be added later.
- Workflows can be audited / ran dry with helpful logs to avoid black box behaviour

+++

+++ ## 4\. Scope 1 (MVP)

**In scope**

- Rebuild the existing "Follow-ups" Feature as a customizable workflow.
  - It has a trigger: The response being completed
  - It has a condition: User hit specific Thank You card
  - It has an action: Send an email to a team mate or an email from the survey.
  - It helps us reduce the complexity of the survey editor
  - It helps us untangle existing functionality (which is a longer term product objective)

**Out of scope**

- Integrations
- Scheduling workflows
- Anything from the success criteria that can be added later on without causing too much headache - your call :)

+++

+++ ## 5\. Approach (High-level)

Here, you'll need a bit of context around the genesis of Formbricks. This story has two threads: The Product Story and the Open Source Strategy story.

The Product Story:

1.  Formbricks started as an in-product survey solution leaning on Sprig.com. Qualtrics was always the target, but to be able to compete - we thought - we should do a small thing better instead of competing on the main front.
2.  Over time, we've learned that in-product surveys alone don't offer deep enough value and are not practiced by enough teams to pick up adoption fast. Also, our OS community kept requesting Link-based surveys, so we shipped them (essentially rendering the in-app widget on a page, calling it "Link Survey"). Adoption was great, today over 80% of our suveys are Link Surveys (and we still render the in-prod widget, which is likely something we should flip around).
3.  However, we had already gone down the path of building one, rather monolythic system, not only from a tech point of view (NextJS with server functions instead of backend <> frontend split, mono repo) but also from a product / engineering design angle: We didn't really build a "Survey creation" function, and a "Distribution" function, nor a "Reporting" function; Formbricks is mostly centered around the App UI with some outward-facing APIs (we don't use much ourselves, hence they are inconsistent and incomplete. So far, so good, this is pretty normal as a startup when trying to figure out what works and who is our customer.
4.  By now, we've learned that large organizations are interested in Open Source stuff, because it gives them Infrastructure Resilience, less Compliance Headache, and often a Cost Advantage. Also, they have the DevOps teams to deploy it. Also, we have learned that Experience Management is practiced in 10 orgs in 10 different ways, mostly, because it is more of an organizational activity than a software category. It's like Go-to-market: It changes per industry, company size, region, so a CRM needs to be versatile enough to support that. We've got burned trying to build an opinionated "use-it-this-one-way" system, because many leads decided to just not buy Formbricks then, because adopting it would've meant changing how they work, which most teams are not very happy to do. Versatility drives adoption, adoption drives revenue, and revenue pays our bills :)
5.  So we've been talking about build Formbricks "API-first" for some time, and the Hub is the first artefact of that.

Hub? [Hub](https://hub.formbricks.com)!

This brings us to the Open Source Strategy:

1. Formbricks started with a rather common Community Edition (AGPLv3) <> Enterprise Edition (prop. license) split. There are many success stories for this approach (n8n, PostHog, Cal.com…) most of which change their licensing approach over time for a variety of reasons (hard to maintain, hard to monetize, hard to keep secure).
2. Also, there's been a logical flaw which bothered us from the beginning: Open sourcing a dev tool makes sense, because developers play with it and carry it into organizations. App-based open source is less obvious, because the people who use it (operators) often don't care about open source at all, they just want to use the app. So the main USP is self-hosting for compliance reasons, but you can do self-hosting without open source.
3. Thirdly, there's a fundamental tension between what the Open Source Community wants (the best possible product, often for Prosumers) vs. what the company wants that raised money to build a company (the most monetizable product, often for Enterprises). So how does open sourceing Formbricks make sense? It helps with visibility, it helps with trust, it helps with compliance, it helps with differentiation. But it doesn't really help so much with "developers carrying it into organizations". It has happened, but it's not our main channel of new business.
4. However, it also has some challenges: Having customer self-host Formbricks and having to support that introduces significant complexity to the business. We cannot simply deploy to prod 5x per day and fix a bug in minutes, when it comes up. Siemens needs the approval of a security board that comes together every 8 weeks to deploy a new version of Formbricks, for example.
5. So starting in September last year, we started exploring different approaches of "doing open source" and boiled a multi-month-long conversation down [to this document (WIP)](https://www.notion.so/formbricks/Formbricks-Strategy-2b4e5de84a58806d8806c7e407e6ad03?source=copy_link) - Danger warning: It's the BIG picture and aims to bring Open Source & building a venture-backed company together. Rereading it after 4 month, it needed just a bit of trimming and we're still "on track".

Now, with all of the above incl. the linked Notion document, I hope that the pieces are starting to fall into place on how & where Workflows will fit into the big picture. It doesn't have to make sense from the get go (or at all), and having built OS yourself, you probably have your views and thoughts - we're super curious to hear them :)

Now, let's zoom in a bit more and talk about Workflows in the world of Experience Management.

+++

+++ ## Workflows in XM

We've done quite some work here already on the concept side. Also, with the Survey Editor 2.0 redesign, we made the experience that it doesn't fly if we design the full end-to-end experience, then break it down into pieces and then ship it. We spent wayyy to much time discussing UX questions when we should have been building up momentum with the new feature. We are doing this differently with Workflows.

However, it still makes sense to have context to streamline all of the decisions we have to make as a team (see above).

Here is condensate of the [Product Research & Design work](https://www.figma.com/board/LZC6XyMIqyzea2t8NqcGwu/Workflows--Scope-1?node-id=0-1&t=GIvxONVrrgxRIhYw-1) we have done in anticipation of building Workflows. You don't need to process it all, but it helps understanding where the journey is going, how versatile surveys need to be, etc.

+++

+++ ## 6\. Security Considerations

- Does this feature process sensitive or personal data?
  - Yes
- Are access control and permissions clearly defined?
  - Not yet (Read / Write / Manage via Team)
- Can this be abused (e.g. spam, rate limits, validation)?
  - Yes, super important!
- Are new dependencies or infrastructure introduced and vetted?
  - Probably

+++

## 7\. Authorization

@matti how can we avoid the issues we had around Hub here?

"Workflows are Workspace-scoped"

## 8\. Risks / Open Questions

There's likely plenty of questions, embrace the confusion and ship v0.1 😛

## 9\. Meta Tasks

1.  Read the above incl. all attached documents. Take your time.
2.  Take a walk.
3.  Then read them again (please): now that you have the full context, it'll make more sense (hopefully)
4.  ✅ Research how [Twenty](https://github.com/twentyhq/twenty) built their workflows (what we know: xyflow, React Flow, BullMQ)
5.  Come up with a plan on which of the Success Criteria we should tackle with Scope 1 - and which we can safely postpone
    1. Actions:
       1. Send email (to team & data in response)
       2. Send Webhook // API call
6.  ✅ Write a refined concept in bullets, no slob pls
    1. [2. Concept and Scope](https://linear.app/formbricks/document/2-concept-and-scope-d038f17243d7)
7.  Write high-level milestones for the project
8.  Present your initial concept to the Workflows team, challenge it together.
9.  Ship an MVP with key ~~engineering~~ design hypothesis implemented (Proof of Concept to validate the design and choices), gather feedback
10. Iterate as you refine for beta production use

## Milestones

- Workflows M0 - Concept

  Complete the planning and alignment work before implementation. This milestone turns the project summary, and the mentioned meta tasks into the refined Workflows concept, MVP/Beta boundary, architecture direction, milestones, and ticket backlog.

  The output is not product code. It is the shared implementation contract the team can review before building: what the MVP proves, what the PoC validates first, what moves to Beta, and which architecture constraints must hold.

  [2. Concept and Scope](https://linear.app/formbricks/document/2-concept-and-scope-d038f17243d7)

## Metadata

- URL: [https://linear.app/formbricks/project/workflows-ce94b3bbc18e/overview](https://linear.app/formbricks/project/workflows-ce94b3bbc18e/overview)
- Status: Planned
- Lead: Javier
- Members: Johannes, Javier, tiago@formbricks.com, Dhruwang Jariwala
- Start date: May 4th
- Target date: Not set
