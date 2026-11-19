{% for item in site.data.nav -%}
- [{{ item.label }}]({{ item.url }}){% if page.url == item.url %} (current){% endif %}
{% endfor -%}
