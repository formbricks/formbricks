"use client";

import { debounce } from "lodash";
import { useEffect, useMemo, useState } from "react";
import React from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-keys";
import { TEnvironment } from "@formbricks/types/environment";
import { LoadingSpinner } from "@formbricks/ui/components/LoadingSpinner";
import { getContactAttributeKeysAction, getContactsAction } from "../actions";
import { TContactTableData, TContactWithAttributes } from "../types/contact";
import { ContactTable } from "./ContactTable";

interface ContactDataViewProps {
  environment: TEnvironment;
  itemsPerPage: number;
}

export const ContactDataView = ({ environment, itemsPerPage }: ContactDataViewProps) => {
  const [contacts, setContacts] = useState<TContactWithAttributes[]>([]);
  const [isContactsLoaded, setIsContactsLoaded] = useState<boolean>(false);
  const [isAttributesLoaded, setIsAttributesLoaded] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>("");
  const [environmentAttributes, setEnvironmentAttributes] = useState<TContactAttributeKey[]>([]);

  // Fetch environment attributes
  useEffect(() => {
    const fetchAttributes = async () => {
      setIsAttributesLoaded(false);
      try {
        const environmentAttributesResponse = await getContactAttributeKeysAction({
          environmentId: environment.id,
        });
        const attrs = environmentAttributesResponse?.data || [];

        const restAttributes = attrs.filter(
          (attr) => !["userId", "email", "firstName", "lastName"].includes(attr.key)
        );

        setEnvironmentAttributes(restAttributes);
      } catch (err) {
        console.error("Error fetching environment attributes:", err);
        setEnvironmentAttributes([]);
      } finally {
        setIsAttributesLoaded(true);
      }
    };

    fetchAttributes();
  }, [environment.id]);

  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      setIsContactsLoaded(false);
      try {
        setHasMore(true);
        const contactsResponse = await getContactsAction({
          environmentId: environment.id,
          offset: 0,
          searchValue,
        });
        const contactsData = contactsResponse?.data || [];
        setContacts(contactsData);

        if (contactsData.length < itemsPerPage) {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
        setContacts([]);
        setHasMore(false);
      } finally {
        setIsContactsLoaded(true);
      }
    };

    const debouncedFetchContacts = debounce(fetchContacts, 300);
    debouncedFetchContacts();

    return () => {
      debouncedFetchContacts.cancel();
    };
  }, [searchValue, environment.id, itemsPerPage]);

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
  const deletePersons = (personIds: string[]) => {
    setContacts((prevContacts) => prevContacts.filter((p) => !personIds.includes(p.id)));
  };

  // Prepare data for the ContactTable component
  const contactsTableData: TContactTableData[] = useMemo(() => {
    return contacts.map((person) => ({
      id: person.id,
      userId: person.attributes.userId ?? "",
      email: person.attributes.email ?? "",
      firstName: person.attributes.firstName ?? "",
      lastName: person.attributes.lastName ?? "",
      attributes: (environmentAttributes ?? []).map((attr) => ({
        key: attr.key,
        name: attr.name,
        value: person.attributes[attr.key] ?? "",
      })),
    }));
  }, [contacts, environmentAttributes]);

  // Show a loading indicator until both contacts and attributes are loaded
  if (!isContactsLoaded || !isAttributesLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <ContactTable
      data={contactsTableData}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      isDataLoaded={isContactsLoaded && isAttributesLoaded}
      deletePersons={deletePersons}
      environmentId={environment.id}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
    />
  );
};
