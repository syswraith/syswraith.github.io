---
layout: default
permalink: /projects
title: Projects • Syswraith
description: "Syswraith's projects, including wordlist generators, ciphers, botnets, interpreters, and scrapers."
og_description: "Explore Syswraith's security tools, terminal games, interpreters, and scrapers."
author: Syswraith
keywords: "cybersecurity, security tools, wordlist generator, reverse engineering, web scrapers, command-and-control, programming projects"
container_class: projects-container
---

# Projects

{% include nav.html class="back-nav" %}

{% for project in site.data.projects %}
**[{{ project.name }}]({{ project.url }})** — {{ project.meta }}
{: .project-title}

{{ project.description }}
{: .project-description}

{% unless forloop.last %}---{% endunless %}

{% endfor %}
