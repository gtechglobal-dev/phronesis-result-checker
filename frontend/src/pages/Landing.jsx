import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div>
      <section className="relative bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center md:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
                Welcome to{' '}
                <span className="text-yellow-400">Phronesis</span>{' '}
                Int'l School
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-yellow-300 font-medium">
                30A & 30B NTA Road, Opp. Govt. Girls School, R/Okuta by 1 Okoa Str., Beside St. France Cath. Church, Port-Harcourt
              </p>
              <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-200 leading-relaxed">
                A centre for academic excellence, nurturing young minds from Montessori through Secondary
                education. Our result checker portal provides parents and students with seamless access
                to academic performance records.
              </p>
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
                <Link
                  to="/check-result"
                  className="bg-yellow-500 hover:bg-yellow-600 text-[#1B5E20] font-semibold px-6 sm:px-8 py-3 rounded-lg transition shadow-lg text-center"
                >
                  Check Result
                </Link>
                <Link
                  to="/signup"
                  className="border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-[#1B5E20] font-semibold px-6 sm:px-8 py-3 rounded-lg transition text-center"
                >
                  Get Started
                </Link>
              </div>
            </div>
            <div className="hidden md:flex justify-center">
              <img
                src="/school logo.png"
                alt="Phronesis Int'l School"
                className="w-48 h-48 lg:w-64 lg:h-64 object-contain rounded-full shadow-2xl bg-white/10 p-4"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#1B5E20]">Our Academic Arms</h2>
          <p className="text-center text-gray-600 mt-2 text-sm sm:text-base">Comprehensive education from foundation to advanced level</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-8 sm:mt-10">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 sm:p-6 text-center hover:shadow-lg transition">
              <div className="text-3xl sm:text-4xl mb-3">🧸</div>
              <h3 className="text-lg sm:text-xl font-bold text-[#1B5E20]">Montessori</h3>
              <p className="text-gray-600 mt-2 text-xs sm:text-sm">
                Early childhood education with the Montessori method, fostering independence and a love for learning.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 sm:p-6 text-center hover:shadow-lg transition">
              <div className="text-3xl sm:text-4xl mb-3">🎨</div>
              <h3 className="text-lg sm:text-xl font-bold text-[#1B5E20]">Nursery</h3>
              <p className="text-gray-600 mt-2 text-xs sm:text-sm">
                Nursery 1 - 3. Building social skills, creativity, and foundational knowledge in a nurturing environment.
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 sm:p-6 text-center hover:shadow-lg transition">
              <div className="text-3xl sm:text-4xl mb-3">📚</div>
              <h3 className="text-lg sm:text-xl font-bold text-[#1B5E20]">Primary School</h3>
              <p className="text-gray-600 mt-2 text-xs sm:text-sm">
                Primary 1 - 6. Building a strong academic foundation with character development and creative learning.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 sm:p-6 text-center hover:shadow-lg transition">
              <div className="text-3xl sm:text-4xl mb-3">🎓</div>
              <h3 className="text-lg sm:text-xl font-bold text-[#1B5E20]">Secondary School</h3>
              <p className="text-gray-600 mt-2 text-xs sm:text-sm">
                JSS 1 - SSS 3. Comprehensive secondary education preparing students for academic excellence and leadership.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#1B5E20]">Portal Features</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-8 sm:mt-10">
            <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md border-t-4 border-yellow-500">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">For Parents</h3>
              <p className="text-gray-600 mt-2 text-xs sm:text-sm">View and download your ward's results across all sessions and terms.</p>
            </div>
            <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md border-t-4 border-yellow-500">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">For Teachers</h3>
              <p className="text-gray-600 mt-2 text-xs sm:text-sm">Manage class results, add performance comments, and track student progress.</p>
            </div>
            <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md border-t-4 border-yellow-500 sm:col-span-2 lg:col-span-1">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">Exam Officers</h3>
              <p className="text-gray-600 mt-2 text-xs sm:text-sm">Full administrative control over students, classes, subjects, and result management.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-[#1B5E20] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-yellow-400">Check Your Result Now</h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-200">Enter your registration number to view your academic performance</p>
          <Link
            to="/check-result"
            className="mt-5 sm:mt-6 inline-block bg-yellow-500 hover:bg-yellow-600 text-[#1B5E20] font-semibold px-8 sm:px-10 py-3 rounded-lg transition shadow-lg"
          >
            Check Result
          </Link>
        </div>
      </section>
    </div>
  )
}
