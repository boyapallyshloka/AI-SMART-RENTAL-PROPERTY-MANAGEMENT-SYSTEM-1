import React, { useState, useEffect } from 'react'
import {
  MapPin,
  Building2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Info,
} from 'lucide-react'
import { Button, Input, Loader } from '../ui'
import { updateMyOwnerProfile } from '../../api/ownerProfileApi'
import { getPincodeDetails } from '../../api/locationApi'

/**
 * Enterprise Owner Profile Address Form
 * 
 * Contract Alignment:
 * - Load/Save: Authenticated GET/PUT /api/owner-profile/me
 * - Pincode Autofill: Authenticated GET /api/location/pincode/{pincode}
 * - Coordinate Exclusion: Strictly omits latitude/longitude (OwnerProfileUpdateRequest DTO does not have coordinates)
 * - Property Endpoint Separation: Never targets /api/owner/properties/{id}/address
 */
export default function OwnerProfileAddressForm({
  initialData,
  onSaved,
  isStandaloneCard = true,
}) {
  const [formData, setFormData] = useState({
    profileImage: '',
    addressLine1: '',
    addressLine2: '',
    area: '',
    district: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
  })

  const [fieldErrors, setFieldErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [saveError, setSaveError] = useState(null)

  // Location Pincode lookup state
  const [isLookingUpPincode, setIsLookingUpPincode] = useState(false)
  const [pincodeLookupMessage, setPincodeLookupMessage] = useState(null)
  const [areaSuggestions, setAreaSuggestions] = useState([])

  // Populate from initial data
  useEffect(() => {
    if (initialData) {
      setFormData({
        profileImage: initialData.profileImage || '',
        addressLine1: initialData.addressLine1 || '',
        addressLine2: initialData.addressLine2 || '',
        area: initialData.area || '',
        district: initialData.district || '',
        city: initialData.city || '',
        state: initialData.state || '',
        country: initialData.country || 'India',
        pincode: initialData.pincode || '',
      })
    }
  }, [initialData])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy[field]
        return copy
      })
    }

    if (saveSuccess) setSaveSuccess('')
    if (saveError) setSaveError(null)
  }

  // Location Pincode Autofill Trigger
  const handlePincodeChange = async (e) => {
    const rawVal = e.target.value
    const cleaned = rawVal.replace(/\D/g, '').slice(0, 6)
    handleInputChange('pincode', cleaned)

    if (cleaned.length === 6) {
      await performPincodeLookup(cleaned)
    } else {
      setPincodeLookupMessage(null)
      setAreaSuggestions([])
    }
  }

  const performPincodeLookup = async (pin) => {
    setIsLookingUpPincode(true)
    setPincodeLookupMessage(null)

    try {
      const pinData = await getPincodeDetails(pin)
      if (pinData) {
        setFormData((prev) => ({
          ...prev,
          state: pinData.state || prev.state,
          district: pinData.district || prev.district,
          city: pinData.city || pinData.district || prev.city,
          country: pinData.country || prev.country || 'India',
          area:
            prev.area ||
            (Array.isArray(pinData.areas) && pinData.areas.length > 0
              ? pinData.areas[0]
              : prev.area),
        }))

        if (Array.isArray(pinData.areas) && pinData.areas.length > 0) {
          setAreaSuggestions(pinData.areas)
        } else {
          setAreaSuggestions([])
        }

        const locationLabel = [pinData.city || pinData.district, pinData.state]
          .filter(Boolean)
          .join(', ')

        setPincodeLookupMessage({
          type: 'success',
          text: `Verified: ${locationLabel}`,
        })
      }
    } catch (err) {
      console.warn('Pincode lookup failed:', err)
      setPincodeLookupMessage({
        type: 'error',
        text: 'Address lookup unavailable for this pincode. Please enter details manually.',
      })
      setAreaSuggestions([])
    } finally {
      setIsLookingUpPincode(false)
    }
  }

  const handleSelectArea = (areaName) => {
    handleInputChange('area', areaName)
  }

  const validateForm = () => {
    const errors = {}

    if (formData.pincode && formData.pincode.trim() !== '') {
      const pin = formData.pincode.trim()
      if (!/^\d{6}$/.test(pin)) {
        errors.pincode = 'Pincode must contain exactly 6 digits'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (isSaving) return
    if (!validateForm()) return

    setIsSaving(true)
    setSaveSuccess('')
    setSaveError(null)

    try {
      // Strictly excludes latitude/longitude
      const payload = {
        profileImage: formData.profileImage.trim() || undefined,
        addressLine1: formData.addressLine1.trim() || undefined,
        addressLine2: formData.addressLine2.trim() || undefined,
        area: formData.area.trim() || undefined,
        district: formData.district.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        country: formData.country.trim() || 'India',
        pincode: formData.pincode.trim() || undefined,
      }

      const updated = await updateMyOwnerProfile(payload)
      setSaveSuccess('Owner address profile updated successfully.')

      if (onSaved) {
        onSaved(updated)
      }

      setTimeout(() => setSaveSuccess(''), 4000)
    } catch (err) {
      console.error('Failed to update owner profile address:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save owner address. Please check your inputs and try again.'
      setSaveError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (initialData) {
      setFormData({
        profileImage: initialData.profileImage || '',
        addressLine1: initialData.addressLine1 || '',
        addressLine2: initialData.addressLine2 || '',
        area: initialData.area || '',
        district: initialData.district || '',
        city: initialData.city || '',
        state: initialData.state || '',
        country: initialData.country || 'India',
        pincode: initialData.pincode || '',
      })
      setFieldErrors({})
      setPincodeLookupMessage(null)
      setAreaSuggestions([])
      setSaveError(null)
      setSaveSuccess('')
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5 text-xs">
      {/* Informational Guidance Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F0F4F8] border border-[#D9E0E6] text-[#243447]">
        <Info className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-xs text-[#243447]">
            Owner Official Postal Address
          </p>
          <p className="text-[11px] text-[#5B6875] leading-relaxed">
            This official address is linked to your registered Property Owner profile (via{' '}
            <code className="px-1 py-0.5 rounded bg-white text-[#315A7D] font-mono text-[10px] border border-[#D9E0E6]">
              /api/owner-profile/me
            </code>
            ) and appears on generated rental agreements and official documentation.
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-[#EDF7EE] border border-[#CDE9D0] text-[#2C6E3B] text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2C6E3B]" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Error Alert */}
      {saveError && (
        <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-[#F8D7DA] text-[#B94A48] text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#B94A48]" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Street Address Line 1 */}
        <div>
          <Input
            label="Address Line 1"
            name="address-line1"
            autoComplete="address-line1"
            placeholder="Street address, building number, house / flat no."
            value={formData.addressLine1}
            onChange={(e) => handleInputChange('addressLine1', e.target.value)}
          />
        </div>

        {/* Street Address Line 2 */}
        <div>
          <Input
            label="Address Line 2 (Optional)"
            name="address-line2"
            autoComplete="address-line2"
            placeholder="Apartment, suite, unit, floor, or landmark"
            value={formData.addressLine2}
            onChange={(e) => handleInputChange('addressLine2', e.target.value)}
          />
        </div>

        {/* Pincode with Auto-fill helper */}
        <div className="space-y-1">
          <div className="relative">
            <Input
              label="Postal Pincode (6 Digits)"
              name="postal-code"
              autoComplete="postal-code"
              inputMode="numeric"
              placeholder="e.g. 500081"
              value={formData.pincode}
              onChange={handlePincodeChange}
              error={fieldErrors.pincode}
              helperText="Entering a 6-digit pincode automatically auto-fills City, District, and State"
            />
            {isLookingUpPincode && (
              <div className="absolute right-3 top-8 flex items-center gap-1.5 text-xs text-[#315A7D] bg-white/95 px-2 py-0.5 rounded pointer-events-none">
                <Loader size="xs" />
                <span className="text-[11px] font-medium">Verifying...</span>
              </div>
            )}
          </div>

          {pincodeLookupMessage && (
            <p
              className={`text-[11px] font-medium flex items-center gap-1.5 mt-1 ${
                pincodeLookupMessage.type === 'error'
                  ? 'text-amber-700'
                  : 'text-[#2C6E3B]'
              }`}
            >
              {pincodeLookupMessage.type === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{pincodeLookupMessage.text}</span>
            </p>
          )}
        </div>

        {/* Locality Suggestions from Pincode */}
        {areaSuggestions.length > 0 && (
          <div className="p-3 rounded-xl bg-[#F0F5FA] border border-[#D9E0E6] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#315A7D]">
                Suggested Localities (India Post for {formData.pincode})
              </span>
              <span className="text-[10px] text-[#5B6875]">Click to auto-fill Area</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
              {areaSuggestions.map((sugg, idx) => (
                <button
                  key={`${sugg}-${idx}`}
                  type="button"
                  onClick={() => handleSelectArea(sugg)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors border ${
                    formData.area.toLowerCase() === sugg.toLowerCase()
                      ? 'bg-[#315A7D] text-white border-[#315A7D] shadow-2xs'
                      : 'bg-white text-[#243447] border-[#D9E0E6] hover:bg-slate-50'
                  }`}
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Area & District Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Area / Locality"
            placeholder="e.g. Madhapur, Hitec City"
            value={formData.area}
            onChange={(e) => handleInputChange('area', e.target.value)}
          />

          <Input
            label="District"
            placeholder="e.g. Hyderabad"
            value={formData.district}
            onChange={(e) => handleInputChange('district', e.target.value)}
          />
        </div>

        {/* City, State & Country Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label="City"
            name="address-level2"
            autoComplete="address-level2"
            placeholder="e.g. Hyderabad"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
          />

          <Input
            label="State"
            name="address-level1"
            autoComplete="address-level1"
            placeholder="e.g. Telangana"
            value={formData.state}
            onChange={(e) => handleInputChange('state', e.target.value)}
          />

          <Input
            label="Country"
            name="country-name"
            autoComplete="country-name"
            placeholder="e.g. India"
            value={formData.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
          />
        </div>
      </div>

      {/* Form Submission Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#D9E0E6]">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={isSaving}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Reset
        </Button>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isSaving}
          leftIcon={
            isSaving ? <Loader size="xs" /> : <Save className="w-3.5 h-3.5" />
          }
        >
          {isSaving ? 'Saving Address...' : 'Save Profile Address'}
        </Button>
      </div>
    </form>
  )

  if (!isStandaloneCard) {
    return formContent
  }

  return (
    <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
      <div className="border-b border-[#D9E0E6] pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center text-[#315A7D]">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#243447]">
              Owner Profile Address
            </h3>
            <span className="text-xs text-[#5B6875]">
              Official address configuration for rental contracts & verification
            </span>
          </div>
        </div>
      </div>

      {formContent}
    </div>
  )
}
