import { NavLink } from 'react-router-dom'

export interface SectionLink {
  to: string
  label: string
  end?: boolean
}

interface Props {
  links: SectionLink[]
  ariaLabel: string
  /** Optional override for active matching (e.g. treat /works vs /works/plans separately). */
  isActive?: (to: string, end?: boolean) => boolean
}

export function SectionSubnav({ links, ariaLabel, isActive }: Props) {
  return (
    <nav className="section-subnav" aria-label={ariaLabel}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive: routeActive }) => {
            const active = isActive ? isActive(link.to, link.end) : routeActive
            return active ? 'section-subnav-link active' : 'section-subnav-link'
          }}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
