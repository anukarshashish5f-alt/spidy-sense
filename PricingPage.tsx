import { Check, Zap, Building2, Crown, Calendar, ArrowRight, Star } from 'lucide-react';
import { useState } from 'react';

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

export default function PricingPage({ onNavigate }: PricingPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = [
    {
      id: 'weekly',
      name: 'Weekly',
      price: 5,
      period: '7 days',
      icon: Zap,
      accent: 'from-amber-500 to-orange-500',
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
      popular: false,
    },
    {
      id: 'monthly',
      name: 'Monthly',
      price: 17,
      period: '30 days',
      icon: Calendar,
      accent: 'from-red-500 to-rose-500',
      border: 'border-red-500/40',
      glow: 'shadow-[0_0_40px_rgba(230,36,41,0.2)]',
      popular: true,
    },
    {
      id: 'yearly',
      name: 'Yearly',
      price: 50,
      period: '12 months',
      icon: Crown,
      accent: 'from-blue-500 to-cyan-500',
      border: 'border-blue-500/30',
      glow: 'shadow-[0_0_30px_rgba(59,130,246,0.15)]',
      popular: false,
    },
  ];

  const features = [
    'Advanced AI detection algorithms',
    'Faster response times',
    'Unlimited image checks',
    'Detailed pattern analysis report',
    'Priority customer support',
    'Full detection history',
  ];

  return (
    <section className="relative z-10 min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <Star className="w-4 h-4 text-red-400" />
            <span className="text-sm text-gray-300">Premium Plans</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Upgrade Your <span className="text-red-500 text-glow">Spyde</span>
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-base leading-relaxed">
            Get advanced detection features, faster response times, and unlimited
            checks. Choose the plan that fits your needs.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 transition-all duration-500 animate-fade-up cursor-pointer ${
                  plan.popular ? 'scale-105' : ''
                } ${isSelected ? 'scale-105' : ''}`}
                style={{ animationDelay: `${i * 0.1}s` }}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div
                  className={`relative h-full rounded-2xl glass p-8 border-2 transition-all duration-300 ${
                    isSelected || plan.popular
                      ? `${plan.border} ${plan.glow}`
                      : 'border-white/5 hover:border-white/15'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <div className="px-4 py-1 rounded-full gradient-spider text-xs font-bold text-white spider-glow">
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${plan.accent} flex items-center justify-center mb-6`}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Name */}
                  <h3 className="text-xl font-bold text-white mb-1">
                    {plan.name} Plan
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Premium access for {plan.period}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-5xl font-black text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-500 text-sm">/ {plan.period}</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {features.map((feat, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-400">
                        <Check className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(plan.id);
                    }}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                      isSelected || plan.popular
                        ? `bg-gradient-to-r ${plan.accent} text-white hover:scale-105`
                        : 'glass text-gray-300 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {isSelected ? 'Plan Selected' : `Choose ${plan.name}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* B2B Section */}
        <div className="rounded-2xl glass p-8 sm:p-12 border border-white/10 mb-8 animate-fade-up delay-300 relative overflow-hidden">
          {/* Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    B2B & API Services
                  </h3>
                  <p className="text-sm text-gray-500">For businesses & enterprises</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed max-w-xl mb-4">
                Need to integrate Spyde AI detection directly into your own
                systems? Our B2B plan provides API access so your company can merge
                our detection engine into your existing platforms, workflows, and
                applications.
              </p>

              <ul className="space-y-2">
                {[
                  'Full API access with authentication tokens',
                  'Seamless integration into your systems',
                  'Custom features tailored to your needs',
                  'Dedicated technical support team',
                ].map((feat, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                    <Check className="w-4 h-4 text-red-400 flex-shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-center lg:items-end gap-4 lg:min-w-[200px]">
              <div className="text-center lg:text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Pricing
                </p>
                <p className="text-2xl font-bold text-white">Custom</p>
                <p className="text-xs text-gray-500 mt-1">
                  Discussed with our team
                </p>
              </div>
              <button className="px-6 py-3 gradient-spider rounded-xl text-sm font-bold text-white spider-glow hover:scale-105 transition-transform duration-300 inline-flex items-center gap-2">
                Contact Us
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Back to detection */}
        <div className="text-center animate-fade-up delay-500">
          <button
            onClick={() => onNavigate('home')}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            Back to Detection
          </button>
        </div>
      </div>
    </section>
  );
}
