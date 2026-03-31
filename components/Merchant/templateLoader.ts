export type TemplateName = 'invoice' | 'delivery'

export async function loadTemplate(name: TemplateName) {
  const response = await fetch(`/api/templates/${name}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Impossible de charger le modèle ${name}`)
  }
  return response.text()
}

export function renderTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.split(`{{${key}}}`).join(value ?? '')
  }, template)
}
