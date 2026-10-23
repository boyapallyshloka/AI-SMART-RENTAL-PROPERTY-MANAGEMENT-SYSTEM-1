import React, { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import DashboardLayout from '../../layouts/DashboardLayout'

import {
  getMaintenanceRequests,
  MAINTENANCE_STATUSES,
  MAINTENANCE_PRIORITIES,
  formatStatusLabel,
  formatPriorityLabel,
  formatCategoryLabel,
  getPriorityBadgeClass,
} from '../../api/maintenanceApi'

import {
  getPublicProperties,
  getPublicPropertyDetails,
} from '../../api/propertyApi'

import { getMyApplications } from '../../api/applicationApi'

import {
  Button,
  Input,
  Select,
  StatusBadge,
  EmptyState,
  Loader,
} from '../../components/ui'

import {
  Wrench,
  Plus,
  Search,
  RotateCcw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Eye,
  X,
} from 'lucide-react'


export default function TenantMaintenancePage() {


  const location = useLocation()

  // Notification URL:
  // /tenant/maintenance?ticket=25

  const [searchParams] = useSearchParams()



  const [requests, setRequests] = useState([])

  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')

  const [statusFilter, setStatusFilter] = useState('all')

  const [priorityFilter, setPriorityFilter] = useState('all')

  const [selectedTicket, setSelectedTicket] = useState(null)

  const [propertyMap, setPropertyMap] = useState({})


  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || ''
  )


  const [fetchError, setFetchError] = useState('')





  // ============================
  // LOAD TENANT MAINTENANCE DATA
  // ============================

  const loadTenantRequests = async () => {


    setLoading(true)

    setFetchError('')


    try {


      const [
        maintRes,
        publicPropsRes,
        appsRes

      ] = await Promise.allSettled([


        getMaintenanceRequests(),


        getPublicProperties(),


        getMyApplications()


      ])




      let allBackendRequests = []




      // Maintenance requests

      if (maintRes.status === 'fulfilled') {


        const value = maintRes.value


        allBackendRequests =

          Array.isArray(value)

            ? value

            :

            Array.isArray(value?.data)

              ? value.data

              : []



        setRequests(allBackendRequests)


      }

      else {


        setFetchError(

          maintRes.reason?.response?.data?.message ||

          maintRes.reason?.message ||

          "Unable to load maintenance requests"

        )


        setRequests([])

      }






      const mapping = {}






      // ============================
      // PUBLIC PROPERTY MAPPING
      // ============================


      if(publicPropsRes.status === 'fulfilled'){


        const properties =

          Array.isArray(publicPropsRes.value)

            ? publicPropsRes.value

            :

            publicPropsRes.value?.data || []





        properties.forEach(property=>{


          const id =

            property.propertyId ??

            property.id





          const name =

            property.propertyName ??

            property.name ??

            property.title





          if(id != null && name){


            mapping[String(id)] = name

            mapping[Number(id)] = name


          }


        })


      }






      // ============================
      // APPLICATION PROPERTY MAPPING
      // ============================


      if(appsRes.status === 'fulfilled'){


        const applications =

          Array.isArray(appsRes.value)

            ? appsRes.value

            :

            appsRes.value?.data || []





        applications.forEach(application=>{


          const id = application.propertyId

          const name = application.propertyName





          if(id != null && name){


            mapping[String(id)] = name

            mapping[Number(id)] = name


          }


        })


      }






      // ============================
      // FIND MISSING PROPERTY NAMES
      // ============================


      const missingPropertyIds = [


        ...new Set(

          allBackendRequests

          .map(req=>req.propertyId)

          .filter(

            id =>

            id != null &&

            !mapping[String(id)]

          )

        )


      ]






      await Promise.allSettled(


        missingPropertyIds.map(async(id)=>{


          try{


            const response =

              await getPublicPropertyDetails(id)




            const details =

              response?.data || response





            const name =


              details?.property?.propertyName ||

              details?.propertyName ||

              details?.name





            if(name){


              mapping[String(id)] = name

              mapping[Number(id)] = name


            }


          }

          catch(error){}



        })


      )






      setPropertyMap(mapping)



    }

    catch(error){


      setFetchError(

        error?.message ||

        "Unable to load maintenance requests"

      )


      setRequests([])


    }


    finally{


      setLoading(false)


    }



  }







  // Initial API call

  useEffect(()=>{


    loadTenantRequests()


  },[])







  // ============================
  // NOTIFICATION DEEP LINK
  // ============================


  useEffect(()=>{


    if(

      loading ||

      requests.length === 0 ||

      selectedTicket

    ){

      return

    }





    const ticketId =

      searchParams.get("ticket")





    if(!ticketId){

      return

    }





    const matchedTicket =

      requests.find(req=>


        String(

          req.requestId ||

          req.id ||

          req.ticketNumber


        ) === String(ticketId)


      )





    if(matchedTicket){


      console.log(

        "Opening notification ticket:",

        ticketId

      )



      setSelectedTicket(matchedTicket)


    }



  },[

    loading,

    requests,

    searchParams,

    selectedTicket

  ])
    // ============================
  // LOAD PROPERTY NAME FOR MODAL
  // ============================

  useEffect(()=>{


    if(

      selectedTicket?.propertyId &&

      !propertyMap[String(selectedTicket.propertyId)]

    ){


      const propertyId = selectedTicket.propertyId



      getPublicPropertyDetails(propertyId)

      .then(response=>{


        const details =

          response?.data || response




        const name =

          details?.property?.propertyName ||

          details?.propertyName ||

          details?.name





        if(name){


          setPropertyMap(previous=>({

            ...previous,

            [String(propertyId)]: name,

            [Number(propertyId)]: name

          }))


        }



      })

      .catch(()=>{})



    }



  },[selectedTicket, propertyMap])







  // ============================
  // PROPERTY DISPLAY NAME
  // ============================


  const getPropertyDisplayName = (ticket)=>{


    if(!ticket)

      return ''




    const propertyId = ticket.propertyId




    const name =


      propertyMap[String(propertyId)] ||

      propertyMap[Number(propertyId)] ||

      ticket.propertyName ||

      ticket.property?.propertyName ||

      ticket.property?.name






    if(name && propertyId != null){


      return `${name} (ID: ${propertyId})`


    }




    if(name){


      return name


    }




    if(propertyId != null){


      return `(ID: ${propertyId})`


    }



    return "—"


  }









  // ============================
  // FILTER OPTIONS
  // ============================


  const statusOptions = [


    {

      value:"all",

      label:"All Statuses"

    },


    ...MAINTENANCE_STATUSES.map(status=>({


      value:status,


      label:formatStatusLabel(status)


    }))


  ]






  const priorityOptions = [


    {

      value:"all",

      label:"All Priorities"


    },


    ...MAINTENANCE_PRIORITIES.map(priority=>({


      value:priority,


      label:`${formatPriorityLabel(priority)} Priority`


    }))


  ]









  // ============================
  // FILTER MAINTENANCE REQUESTS
  // ============================


  const filteredRequests = requests.filter(req=>{


    const query =

      searchQuery

      .toLowerCase()

      .trim()




    const ticketNumber =


      String(

        req.requestId ||

        req.id ||

        req.ticketNumber ||

        ''

      )

      .toLowerCase()





    const description =

      (req.description || '')

      .toLowerCase()






    const category =

      (req.category || '')

      .toLowerCase()





    const propertyName =


      String(


        propertyMap[String(req.propertyId)] ||

        propertyMap[Number(req.propertyId)] ||

        req.propertyName ||

        ''


      )

      .toLowerCase()






    const searchMatch =


      query === '' ||

      ticketNumber.includes(query) ||

      description.includes(query) ||

      category.includes(query) ||

      propertyName.includes(query)







    const statusMatch =


      statusFilter === "all" ||


      String(req.status)

      .toUpperCase() ===

      statusFilter.toUpperCase()







    const priorityMatch =


      priorityFilter === "all" ||


      String(req.priority)

      .toUpperCase() ===

      priorityFilter.toUpperCase()






    return (

      searchMatch &&

      statusMatch &&

      priorityMatch

    )


  })







  const hasActiveFilters =


    searchQuery !== '' ||

    statusFilter !== 'all' ||

    priorityFilter !== 'all'








  const resetFilters = ()=>{


    setSearchQuery('')

    setStatusFilter('all')

    setPriorityFilter('all')


  }







  return (


    <DashboardLayout


      defaultRole="tenant"


      activeItem="maintenance"


      pageTitle="Maintenance"


    >



      <div className="space-y-6">



        {/* SUCCESS MESSAGE */}


        {successMessage && (


          <div className="p-4 rounded-lg bg-[#EDF7EE] border border-[#C6DEC8] flex items-center justify-between">


            <div className="flex items-center gap-2">


              <CheckCircle2 className="w-5 h-5"/>


              <span>

                {successMessage}

              </span>


            </div>




            <button

              onClick={()=>setSuccessMessage('')}

              className="font-bold"

            >

              ×

            </button>



          </div>


        )}








        {/* ERROR MESSAGE */}


        {fetchError && (


          <div className="p-4 rounded-lg bg-[#FDF2F2] border border-red-300 flex items-center justify-between">


            <div className="flex gap-2 items-center">


              <AlertCircle className="w-5 h-5"/>


              <span>

                {fetchError}

              </span>


            </div>




            <Button

              size="sm"

              variant="outline"

              onClick={loadTenantRequests}

            >

              Retry

            </Button>



          </div>


        )}









        {/* HEADER */}


        <div className="flex justify-between items-center">


          <div>


            <h1 className="text-2xl font-bold text-[#243447]">


              Maintenance Requests


            </h1>



            <p className="text-sm text-[#5B6875]">


              Track your maintenance issues and repair status


            </p>


          </div>





          <Link to="/tenant/maintenance/new">


            <Button

              variant="primary"

              leftIcon={<Plus className="w-4 h-4"/>}

            >


              Create Request


            </Button>


          </Link>



        </div>







        {/* FILTER SECTION */}


        <div className="bg-white border rounded-lg p-5">


          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">



            <Input


              placeholder="Search ticket, category, description"


              value={searchQuery}


              onChange={(e)=>setSearchQuery(e.target.value)}


              leftIcon={<Search className="w-4 h-4"/>}


            />





            <Select


              options={statusOptions}


              value={statusFilter}


              onChange={(e)=>setStatusFilter(e.target.value)}


            />





            <Select


              options={priorityOptions}


              value={priorityFilter}


              onChange={(e)=>setPriorityFilter(e.target.value)}


            />





            {hasActiveFilters && (


              <Button


                variant="outline"


                onClick={resetFilters}


                leftIcon={<RotateCcw className="w-4 h-4"/>}


              >

                Reset


              </Button>


            )}



          </div>


        </div>
                {/* LOADING / EMPTY / TABLE */}

        {
          loading ? (


            <div className="bg-white border rounded-lg p-10 flex justify-center">

              <Loader

                text="Loading maintenance requests..."

                size="md"

                center

              />


            </div>



          )


          :


          filteredRequests.length === 0 ? (


            <EmptyState


              icon={<Wrench className="w-8 h-8"/>}


              title="No maintenance requests"


              message={

                hasActiveFilters

                ?

                "No tickets match your filters"

                :

                "You don't have any maintenance requests yet."

              }



              action={

                <Link to="/tenant/maintenance/new">


                  <Button

                    variant="primary"

                    leftIcon={<Plus className="w-4 h-4"/>}

                  >

                    Create Request


                  </Button>


                </Link>

              }


            />


          )



          :



          (


            <div className="bg-white border rounded-lg overflow-hidden">


              <div className="overflow-x-auto">


              <table className="w-full">


              <thead className="bg-[#F7F8FA]">


              <tr>


              <th className="p-3 text-left">
                Ticket #
              </th>


              <th className="p-3 text-left">
                Category
              </th>


              <th className="p-3 text-left">
                Description
              </th>


              <th className="p-3 text-left">
                Priority
              </th>


              <th className="p-3 text-left">
                Submitted Date
              </th>


              <th className="p-3 text-left">
                Status
              </th>


              <th className="p-3 text-left">
                Action
              </th>


              </tr>


              </thead>





              <tbody>


              {


              filteredRequests.map((req,index)=>(


                <tr


                  key={

                    req.requestId ||

                    req.id ||

                    index

                  }


                  className="border-t hover:bg-gray-50"


                >




                <td className="p-3 font-mono text-sm">


                  #

                  {

                    req.requestId ||

                    req.id ||

                    "—"

                  }


                </td>





                <td className="p-3">


                  {formatCategoryLabel(req.category)}


                </td>






                <td className="p-3 max-w-xs">


                  <p className="truncate">


                    {

                      req.description ||

                      "No description"

                    }


                  </p>


                </td>






                <td className="p-3">


                  <span


                    className={`inline-flex items-center px-2 py-1 rounded text-xs border ${

                      getPriorityBadgeClass(req.priority)

                    }`}


                  >


                    {

                      formatPriorityLabel(req.priority)

                    }


                  </span>


                </td>







                <td className="p-3 text-sm">


                  {


                    req.requestedDate


                    ?


                    new Date(

                      req.requestedDate

                    ).toLocaleDateString()


                    :

                    "—"


                  }


                </td>







                <td className="p-3">


                  <StatusBadge


                    status={

                      formatStatusLabel(req.status)

                    }


                    size="sm"


                  />


                </td>








                <td className="p-3">


                  <Button


                    size="sm"


                    variant="outline"


                    leftIcon={

                      <Eye className="w-4 h-4"/>

                    }



                    onClick={()=>


                      setSelectedTicket(req)


                    }


                  >


                    View


                  </Button>


                </td>





                </tr>


              ))


              }



              </tbody>


              </table>


              </div>


            </div>


          )


        }









        {/* TICKET DETAILS MODAL */}


        {


        selectedTicket && (



        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-5">



          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">





            <div className="flex justify-between items-center">


              <h2 className="font-bold text-lg">


                Ticket #

                {


                  selectedTicket.requestId ||

                  selectedTicket.id

                }


              </h2>





              <button


                onClick={()=>setSelectedTicket(null)}


                className="text-gray-500"


              >


                <X/>


              </button>



            </div>








            <div className="space-y-4 mt-5 text-sm">





              <p>


                <b>Category:</b>


                {" "}


                {


                  formatCategoryLabel(

                    selectedTicket.category

                  )


                }


              </p>






              <p>


                <b>Status:</b>


                {" "}


                {


                  formatStatusLabel(

                    selectedTicket.status

                  )


                }


              </p>






              <p>


                <b>Priority:</b>


                {" "}


                {


                  formatPriorityLabel(

                    selectedTicket.priority

                  )


                }


              </p>







              <p>


                <b>Property:</b>


                {" "}


                {


                  getPropertyDisplayName(

                    selectedTicket

                  )


                }


              </p>








              <div>


                <b>Description:</b>



                <div className="mt-2 bg-gray-100 p-3 rounded">


                  {


                    selectedTicket.description ||

                    "No description provided"


                  }


                </div>


              </div>







              {


              selectedTicket.imageUrl && (


                <div>


                  <b>Attached Image:</b>


                  <img


                    src={selectedTicket.imageUrl}


                    alt="maintenance"


                    className="mt-2 rounded-lg max-h-48"


                  />


                </div>


              )


              }





              {


              selectedTicket.cost != null && (



                <div className="bg-[#EAF2F7] p-3 rounded">


                  <b>Repair Cost:</b>


                  {" ₹"}

                  {


                    Number(

                      selectedTicket.cost

                    ).toLocaleString("en-IN")


                  }


                </div>


              )


              }





            </div>








            <div className="mt-6 text-right">


              <Button


                variant="outline"


                onClick={()=>setSelectedTicket(null)}


              >


                Close


              </Button>


            </div>





          </div>


        </div>



        )


        }






      </div>


    </DashboardLayout>


  )


}