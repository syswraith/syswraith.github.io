---
layout: null
permalink: /projects
---

# Projects

{% include nav.md %}

{% for project in site.data.projects %}
**[{{ project.name }}]({{ project.url }})** — {{ project.meta }}

{{ project.description }}

{% unless forloop.last %}---{% endunless %}

{% endfor %}
