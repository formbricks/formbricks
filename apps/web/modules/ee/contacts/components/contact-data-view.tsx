"use client";

import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { debounce } from "lodash";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { deleteContactAction, getContactsAction } from "../actions";
import { TContactTableData, TContactWithAttributes } from "../types/contact";

const ContactsTableDynamic = dynamic(() => import("./contacts-table").then((mod) => mod.ContactsTable), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});

interface ContactDataViewProps {
  environment: TEnvironment;
  contactAttributeKeys: TContactAttributeKey[];
  initialContacts: TContactWithAttributes[];
  itemsPerPage: number;
  isReadOnly: boolean;
  hasMore: boolean;
}

export const ContactDataView = ({
  environment,
  itemsPerPage,
  contactAttributeKeys,
  isReadOnly,
  hasMore: initialHasMore,
  initialContacts,
}: ContactDataViewProps) => {
  const router = useRouter();
  const [contacts, setContacts] = useState<TContactWithAttributes[]>([...initialContacts]);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>("");
  const [isDataLoaded, setIsDataLoaded] = useState(true);

  const isFirstRender = useRef(true);

  const environmentAttributes = useMemo(() => {
    return contactAttributeKeys.filter(
      (attr) => !["userId", "email", "firstName", "lastName"].includes(attr.key)
    );
  }, [contactAttributeKeys]);

  useEffect(() => {
    if (!isFirstRender.current) {
      const fetchData = async () => {
        setIsDataLoaded(false);
        try {
          setHasMore(true);
          const getPersonActionData = await getContactsAction({
            environmentId: environment.id,
            offset: 0,
            searchValue,
          });
          const personData = getPersonActionData?.data;
          if (getPersonActionData?.data) {
            setContacts(getPersonActionData.data);
          }
          if (personData && personData.length < itemsPerPage) {
            setHasMore(false);
          }
        } catch (error) {
          console.error("Error fetching people data:", error);
          toast.error("Error fetching people data. Please try again.");
        } finally {
          setIsDataLoaded(true);
        }
      };

      const debouncedFetchData = debounce(fetchData, 300);
      debouncedFetchData();

      return () => {
        debouncedFetchData.cancel();
      };
    }
  }, [environment.id, itemsPerPage, searchValue]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, []);

  // Fetch next page of contacts
  const fetchNextPage = async () => {
    if (hasMore && !loadingNextPage) {
      setLoadingNextPage(true);
      try {
        const contactsResponse = await getContactsAction({
          environmentId: environment.id,
          offset: contacts.length,
          searchValue,
        });
        const contactsData = contactsResponse?.data || [];

        setContacts((prevContacts) => [...prevContacts, ...contactsData]);

        if (contactsData.length < itemsPerPage) {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching next page of contacts:", error);
      } finally {
        setLoadingNextPage(false);
      }
    }
  };

  // Delete selected contacts
  const deleteContacts = async (contactIds: string[]) => {
    setContacts((prevContacts) => prevContacts.filter((contact) => !contactIds.includes(contact.id)));

    router.refresh();
  };

  // Prepare data for the ContactTable component
  const contactsTableData: TContactTableData[] = useMemo(() => {
    return contacts.map((contact) => ({
      id: contact.id,
      userId: contact.attributes.userId ?? "",
      email: contact.attributes.email ?? "",
      firstName: contact.attributes.firstName ?? "",
      lastName: contact.attributes.lastName ?? "",
      attributes: (environmentAttributes ?? []).map((attr) => ({
        key: attr.key,
        name: attr.name,
        value: contact.attributes[attr.key] ?? "",
      })),
    }));
  }, [contacts, environmentAttributes]);

  return (
    <ContactsTableDynamic
      data={contactsTableData}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      isDataLoaded={isFirstRender.current ? true : isDataLoaded}
      deleteContacts={deleteContacts}
      environmentId={environment.id}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      isReadOnly={isReadOnly}
    />
  );
};
