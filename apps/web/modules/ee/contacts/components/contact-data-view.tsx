"use client";

import { debounce } from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { getContactsAction } from "../actions";
import { TContactTableData, TContactWithAttributes } from "../types/contact";
import { ContactsTable } from "./contacts-table";

interface ContactDataViewProps {
  environment: TEnvironment;
  contactAttributeKeys: TContactAttributeKey[];
  initialContacts: TContactWithAttributes[];
  itemsPerPage: number;
  isReadOnly: boolean;
  hasMore: boolean;
  isQuotasAllowed: boolean;
}

export const ContactDataView = ({
  environment,
  itemsPerPage,
  contactAttributeKeys,
  isReadOnly,
  hasMore: initialHasMore,
  initialContacts,
  isQuotasAllowed,
}: ContactDataViewProps) => {
  const [contacts, setContacts] = useState<TContactWithAttributes[]>([...initialContacts]);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>("");

  const isFirstRender = useRef(true);
  const prevEnvironmentId = useRef(environment.id);
  const isResettingSearch = useRef(false);

  // Sync state with server data only when environment changes (real tab navigation)
  useEffect(() => {
    if (prevEnvironmentId.current !== environment.id) {
      prevEnvironmentId.current = environment.id;
      setContacts([...initialContacts]);
      setHasMore(initialHasMore);
      isResettingSearch.current = true;
      setSearchValue("");
    }
  }, [environment.id, initialContacts, initialHasMore]);

  const environmentAttributes = useMemo(() => {
    return contactAttributeKeys.filter(
      (attr) => !["userId", "email", "firstName", "lastName"].includes(attr.key)
    );
  }, [contactAttributeKeys]);

  // Fetch contacts from offset 0 with current search value
  const fetchContactsFromStart = useCallback(async () => {
    // Don't show loading state - fetch in background
    try {
      const contactsResponse = await getContactsAction({
        environmentId: environment.id,
        offset: 0,
        searchValue,
      });
      if (contactsResponse?.data) {
        setContacts(contactsResponse.data);
        // Only update hasMore based on actual response
        setHasMore(contactsResponse.data.length >= itemsPerPage);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Error fetching contacts. Please try again.");
    }
  }, [environment.id, itemsPerPage, searchValue]);

  // Only refetch when search value actually changes (debounced)
  useEffect(() => {
    // Don't trigger search on first render or when resetting after tab navigation
    if (!isFirstRender.current && !isResettingSearch.current) {
      const debouncedFetchData = debounce(fetchContactsFromStart, 300);
      debouncedFetchData();

      return () => {
        debouncedFetchData.cancel();
      };
    }

    // Reset the flag after search reset completes
    if (isResettingSearch.current) {
      isResettingSearch.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

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
  const updateContactList = (contactIds: string[]) => {
    setContacts((prevContacts) => prevContacts.filter((contact) => !contactIds.includes(contact.id)));
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
        dataType: attr.dataType,
      })),
    }));
  }, [contacts, environmentAttributes]);

  return (
    <ContactsTable
      data={contactsTableData}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      isDataLoaded={true}
      updateContactList={updateContactList}
      environmentId={environment.id}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      isReadOnly={isReadOnly}
      isQuotasAllowed={isQuotasAllowed}
      refreshContacts={fetchContactsFromStart}
    />
  );
};
