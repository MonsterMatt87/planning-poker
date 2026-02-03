export function generateRoomId() {
  const countries = [
    "UK", "USA", "Canada", "France", "Germany", "Spain", "Italy", "Japan",
    "China", "Brazil", "India", "Australia", "Sweden", "Norway", "Finland",
    "Denmark", "Ireland", "Poland", "Austria", "Belgium", "Switzerland",
    "Portugal", "Greece", "Netherlands", "Mexico", "SouthAfrica", "NewZealand",
    "Turkey", "Argentina", "Chile", "Colombia", "Peru"
  ];
  const country = countries[Math.floor(Math.random() * countries.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${country}-${num}`.toUpperCase();
}

export function getInitials(name) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "?";
}
