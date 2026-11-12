// JSON strings become content directly; never evaluate portfolio text as markup.
#let data = json.decode(sys.inputs.portfolio)
#set document(title: data.name + " — Résumé", author: data.name)
#set page(paper: "us-letter", margin: 0.5in, numbering: none)
#set text(font: "Liberation Sans", size: 10pt, top-edge: "ascender", bottom-edge: "descender")
// Font ascender/descender bounds plus 3pt give about 12.4pt between baselines.
#set par(leading: 3pt, spacing: 0pt)
#set list(indent: 11pt, body-indent: 4pt, spacing: 3pt, tight: false)

#let section(title) = {
  block(breakable: false, above: 9pt, below: 5pt,
    stack(dir: ttb, spacing: 3pt,
      strong(upper(title)),
      line(length: 100%, stroke: 0.5pt),
    ),
  )
}
#let dated(title, date) = block(above: 0pt, below: 4pt, breakable: false)[
  #grid(columns: (1fr, auto), column-gutter: 8pt, strong(title), align(right, date))
]
#let bullets(items) = {
  if items.len() > 0 { list(..items) }
}
#let role(entry) = {
  dated(entry.title + " | " + entry.organization + if entry.at("location", default: none) != none {
    " - " + entry.location
  } else { "" }, entry.date)
  bullets(entry.bullets)
}
#let url-label(url) = url.replace(regex("^https?://"), "").trim("/")

#align(center)[
  #text(size: 20pt, weight: "bold", upper(data.name))
  #v(3pt)
  #text(size: 9pt)[
    #data.location | #link("mailto:" + data.email, data.email) | #link(data.links.website, url-label(data.links.website)) | #link(data.links.linkedin, url-label(data.links.linkedin)) | #link(data.links.github, url-label(data.links.github))
  ]
]

#section("EDUCATION")
#for entry in data.education {
  dated(entry.credential + " | " + entry.institution, entry.date)
  for position in entry.at("roles", default: ()) {
    v(5pt)
    role(position)
  }
}

#section("EXPERIENCE")
#for (index, entry) in data.experience.enumerate() {
  if index > 0 { v(6pt) }
  role(entry)
}

#section("PROJECTS")
#for (index, project) in data.projects.enumerate() {
  if index > 0 { v(6pt) }
  block(above: 0pt, below: 4pt, breakable: false)[
    #strong({
      if project.at("url", default: none) != none {
        link(project.url, project.title)
      } else { project.title }
      if project.technologies.len() > 0 { " | " + project.technologies.join(", ") }
    })
  ]
  bullets(project.bullets)
}

#section("TECHNICAL SKILLS")
#for skill in data.skills {
  block(above: 0pt, below: 3pt)[
    #strong(skill.label + ":") #skill.items.join(", ")
  ]
}
