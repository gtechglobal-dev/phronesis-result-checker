export default function Footer() {
  return (
    <footer className="bg-[#1B5E20] text-white py-6 sm:py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-yellow-400 font-semibold text-base sm:text-lg">Phronesis Int'l School</p>
        <p className="text-xs sm:text-sm mt-1 text-gray-300">Excellence in Education</p>
        <p className="text-xs sm:text-sm text-gray-400 mt-3 max-w-2xl mx-auto leading-relaxed">
          30A & 30B NTA Road, Opp. Govt. Girls School, R/Okuta by 1 Okoa Str., Beside St. France Cath. Church, Port-Harcourt
        </p>
        <p className="text-xs sm:text-sm text-gray-400 mt-2">
          &#9742; 0818-175-9399, 0813-676-7214, 0803-875-1506
        </p>
        <div className="mt-3 text-xs sm:text-sm text-gray-400">
          <p>Montessori | Nursery | Primary | Secondary</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </div>
    </footer>
  )
}
