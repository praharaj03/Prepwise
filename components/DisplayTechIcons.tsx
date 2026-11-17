export default function DisplayTechIcons({ techStack }: TechIconProps) {
  return <div className="tech-chips">{techStack.slice(0, 3).map((tech, index) => <span className="tech-chip" key={tech + index}>{tech}</span>)}{techStack.length > 3 && <span className="tech-chip" title={techStack.slice(3).join(", ")}>+{techStack.length - 3}</span>}</div>;
}
